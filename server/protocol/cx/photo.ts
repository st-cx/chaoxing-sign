// Adapted protocol flow from miaochenxi/chaoxing-sign-cli (MIT).
// See docs/THIRD_PARTY_NOTICES.md. Keep credentials in the existing account session.
import { randomUUID } from 'node:crypto'
import type { Got } from 'got'
import { MAX_SIGN_PHOTO_BYTES } from '~/utils/manualSign'

function safePhotoError(error: unknown, message: string): never {
  // Got errors can contain the token-bearing request URL. Never send them to clients.
  if ((error as any)?.code === 'CX_SESSION_EXPIRED') throw error
  throw new Error(message)
}

export function decodeSignPhoto(value: unknown) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_SIGN_PHOTO_BYTES / 3) * 4 + 64)
    throw new Error('请选择 5 MB 以内的照片')
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('照片格式无效，请重新选择 JPG、PNG 或 WebP 图片')
  const bytes = Buffer.from(match[2], 'base64')
  const mime = match[1]
  const valid = mime === 'image/jpeg' ? bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!valid || bytes.length < 12 || bytes.length > MAX_SIGN_PHOTO_BYTES || bytes.toString('base64') !== match[2])
    throw new Error('照片内容无效或超过 5 MB，请重新选择')
  return { bytes, mime, extension: mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] }
}

export async function getPhotoToken(http: Got) {
  const { body } = await http.get<any>('https://pan-yz.chaoxing.com/api/token/uservalid', {
    responseType: 'json', timeout: { request: 15_000 }, retry: { limit: 0 },
  }).catch(error => safePhotoError(error, '获取照片上传凭证失败，请检查网络或重新登录该学习通账号'))
  const token = body?._token || body?.token || body?.data?._token || body?.data?.token
  if (typeof token !== 'string' || !token || token.length > 1024)
    throw new Error('无法获取云盘上传凭证，请重新登录该学习通账号')
  return token
}

export async function uploadSignPhoto(http: Got, uid: string, photo: ReturnType<typeof decodeSignPhoto>) {
  const token = await getPhotoToken(http)
  const boundary = `----chaoxing-${randomUUID()}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="puid"\r\n\r\n${uid}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sign-photo.${photo.extension}"\r\nContent-Type: ${photo.mime}\r\n\r\n`),
    photo.bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  const { body: result } = await http.post<any>('https://pan-yz.chaoxing.com/upload', {
    searchParams: { _token: token }, body,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    responseType: 'json', timeout: { request: 30_000 }, retry: { limit: 0 },
  }).catch(error => safePhotoError(error, '照片上传失败，未提交签到；请检查网络后重试'))
  const objectId = result?.objectId || result?.data?.objectId
  if (result?.result === false || result?.status === false || typeof objectId !== 'string' || !/^[\w.-]{1,200}$/.test(objectId))
    throw new Error('照片上传未返回有效文件编号，未提交签到；请重试或重新登录')
  return { objectId }
}
