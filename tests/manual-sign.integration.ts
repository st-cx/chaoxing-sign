import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { executeManualSign, requireOwnedSignAccount } from '../server/utils/manualSign'
import { decodeSignPhoto, uploadSignPhoto } from '../server/protocol/cx/photo'
import { manualSignKind } from '../utils/manualSign'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7h8AAAAASUVORK5CYII='
function fixture(otherId = 0, ifPhoto = 1) {
  const activity = { id: '3001', courseId: '1001', clazzId: '2001', activeType: 2, status: 1, otherId, ifPhoto, name: '课堂签到' }
  const cx = {
    user: { uid: '123' }, courseList: [{ courseId: '1001', classId: '2001', name: '示例课程' }],
    getActivityDetail: vi.fn().mockResolvedValue(activity), preSign: vi.fn().mockResolvedValue(''),
    signPhoto: vi.fn().mockResolvedValue('签到成功'), signNormal: vi.fn().mockResolvedValue('签到成功'),
    signCode: vi.fn().mockResolvedValue('签到成功'), signGesture: vi.fn().mockResolvedValue('签到成功'),
    signLocation: vi.fn().mockResolvedValue('签到成功'),
    http: { get: vi.fn().mockResolvedValue({ body: { _token: 'test-token' } }), post: vi.fn().mockResolvedValue({ body: { objectId: 'photo-123' } }) },
  }
  return { cx, activity, input: { uid: '123', courseId: '1001', activityId: '3001', photo: png } }
}
beforeEach(() => vi.stubGlobal('createError', ({ statusCode, message }: any) => Object.assign(new Error(message), { statusCode })))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('manual sign material pipeline', () => {
  it('hides token-bearing network failures while preserving session-expiry handling', async () => {
    const { cx } = fixture()
    cx.http.post.mockRejectedValue(new Error('https://pan-yz.chaoxing.com/upload?_token=secret-token'))
    await expect(uploadSignPhoto(cx.http as any, '123', decodeSignPhoto(png))).rejects.toThrow('照片上传失败')
    const expired = Object.assign(new Error('会话过期'), { code: 'CX_SESSION_EXPIRED' })
    cx.http.get.mockRejectedValue(expired)
    await expect(uploadSignPhoto(cx.http as any, '123', decodeSignPhoto(png))).rejects.toBe(expired)
  })
  it('uploads only after pre-sign succeeds, using the current account, then signs with returned objectId', async () => {
    const { cx, input } = fixture()
    const result = await executeManualSign(cx as any, input)
    expect(result.result).toBe('签到成功')
    expect(cx.preSign.mock.invocationCallOrder[0]).toBeLessThan(cx.http.post.mock.invocationCallOrder[0])
    const [url, options] = cx.http.post.mock.calls[0] as any
    expect(url).toBe('https://pan-yz.chaoxing.com/upload')
    expect(options.body.toString()).toContain('name="puid"\r\n\r\n123\r\n')
    expect(options.searchParams).toEqual({ _token: 'test-token' })
    expect(options.body.includes(Buffer.from(decodeSignPhoto(png).bytes))).toBe(true)
    expect(cx.signPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: '3001' }), { objectId: 'photo-123' })
  })
  it('does not upload or submit missing, forged or oversized photos', async () => {
    const { cx, input } = fixture()
    for (const photo of [undefined, 'data:image/png;base64,aGVsbG8=', 'data:image/svg+xml;base64,PHN2Zz4=', 'a'.repeat(7_000_000)])
      await expect(executeManualSign(cx as any, { ...input, photo })).rejects.toMatchObject({ statusCode: 400 })
    expect(cx.preSign).not.toHaveBeenCalled()
    expect(cx.http.post).not.toHaveBeenCalled()
    expect(cx.signPhoto).not.toHaveBeenCalled()
  })
  it('does not upload again when the upstream already reports signed', async () => {
    const { cx, input } = fixture()
    cx.preSign.mockResolvedValue('已签到过')
    expect((await executeManualSign(cx as any, input)).result).toBe('已签到过')
    expect(cx.http.post).not.toHaveBeenCalled()
  })
  it('does not submit an empty objectId after an upload failure', async () => {
    const { cx, input } = fixture()
    cx.http.post.mockResolvedValue({ body: { result: false } } as any)
    await expect(executeManualSign(cx as any, input)).rejects.toThrow('未提交签到')
    expect(cx.signPhoto).not.toHaveBeenCalled()
  })
  it('rejects ended activities and mismatching courses before any upload', async () => {
    const { cx, input, activity } = fixture()
    cx.getActivityDetail.mockResolvedValue({ ...activity, status: 2 })
    await expect(executeManualSign(cx as any, input)).rejects.toMatchObject({ statusCode: 409 })
    cx.getActivityDetail.mockResolvedValue({ ...activity, clazzId: '999' })
    await expect(executeManualSign(cx as any, input)).rejects.toMatchObject({ statusCode: 400 })
    expect(cx.http.post).not.toHaveBeenCalled()
  })
  it('blocks concurrent clicks per account and releases the lock afterward', async () => {
    const { cx, input } = fixture()
    let release!: (value: string) => void
    cx.preSign.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const first = executeManualSign(cx as any, input)
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    await expect(executeManualSign(cx as any, input)).rejects.toMatchObject({ statusCode: 409 })
    release('已签到过'); await first
    await expect(executeManualSign(cx as any, input)).resolves.toHaveProperty('result', '签到成功')
  })
  it.each([[5, 'signCode'], [3, 'signGesture']])('routes type %s using validated input', async (type, method) => {
    const { cx, input } = fixture(Number(type), 0)
    await expect(executeManualSign(cx as any, { ...input, signCode: '' })).rejects.toMatchObject({ statusCode: 400 })
    await executeManualSign(cx as any, { ...input, signCode: '12589' })
    expect((cx as any)[method]).toHaveBeenCalledWith(expect.anything(), '12589')
    expect(cx.http.post).not.toHaveBeenCalled()
  })
  it('uses server details rather than a client supplied photo/normal flag', async () => {
    const { cx, input } = fixture(0, 0)
    await executeManualSign(cx as any, input)
    expect(cx.signNormal).toHaveBeenCalledOnce()
    expect(cx.http.post).not.toHaveBeenCalled()
    expect(manualSignKind({ otherId: '0', ifPhoto: '1' })).toBe('photo')
  })
  it('rejects missing location instead of silently submitting an unset coordinate', async () => {
    const { cx, input } = fixture(4, 0)
    await expect(executeManualSign(cx as any, input)).rejects.toThrow('请先选择地点')
    expect(cx.signLocation).not.toHaveBeenCalled()
  })
  it('does not send an upload request when the cloud token is unavailable', async () => {
    const { cx } = fixture()
    cx.http.get.mockResolvedValue({ body: {} } as any)
    await expect(uploadSignPhoto(cx.http as any, '123', decodeSignPhoto(png))).rejects.toThrow('凭证')
    expect(cx.http.post).not.toHaveBeenCalled()
  })
})

describe('manual sign account ownership', () => {
  it('requires website login and checks database ownership before accessing material', async () => {
    const { cx } = fixture()
    const findFirst = vi.fn().mockResolvedValue(null)
    const event: any = { context: { cx, prisma: { cxAccount: { findFirst } } } }
    await expect(requireOwnedSignAccount(event, '123')).rejects.toMatchObject({ statusCode: 401 })
    event.session = { uid: 'web-user' }
    await expect(requireOwnedSignAccount(event, '123')).rejects.toMatchObject({ statusCode: 404 })
    expect(findFirst).toHaveBeenCalledWith({ where: { uid: '123', userId: 'web-user' }, select: { uid: true } })
    findFirst.mockResolvedValue({ uid: '123' })
    expect(await requireOwnedSignAccount(event, '123')).toBe(cx)
  })
})
