import type { H3Event } from 'h3'
import { getServerSession } from '#auth'
import type { Cx } from '~/server/protocol/cx'
import { manualSignKind } from '~/utils/manualSign'
import { decodeSignPhoto, uploadSignPhoto } from '~/server/protocol/cx/photo'
import { isQrCoordinates, type QrCoordinates } from '~/utils/qrLocation'
import { resolveClientSignLocation } from '~/server/utils/resolveClientSignLocation'

export async function requireOwnedSignAccount(event: H3Event, uid: string) {
  const session = await getServerSession(event)
  if (!session?.uid) throw createError({ statusCode: 401, message: '请先登录本站' })
  const account = await event.context.prisma.cxAccount.findFirst({ where: { uid, userId: session.uid }, select: { uid: true } })
  if (!account || String(event.context.cx?.user?.uid) !== uid)
    throw createError({ statusCode: 404, message: '学习通账号不存在' })
  return event.context.cx
}

export interface ManualSignInput {
  uid: string
  activityId: string
  courseId: string
  signCode?: string
  photo?: string
  location?: QrCoordinates | null
}
const active = new Set<string>()
export async function executeManualSign(cx: Cx, input: ManualSignInput) {
  if (!/^\d+$/.test(input.activityId) || !/^\d+$/.test(input.courseId))
    throw createError({ statusCode: 400, message: '活动编号或课程编号无效，请刷新活动' })
  if (active.has(input.uid)) throw createError({ statusCode: 409, message: '该账号正在提交，请等待结果' })
  active.add(input.uid)
  try {
    const activity = await cx.getActivityDetail(input.activityId)
    if (!activity || Number(activity.activeType) !== 2 || Number(activity.status) !== 1)
      throw createError({ statusCode: 409, message: '该签到已结束或不存在，请刷新活动' })
    const courses = cx.courseList.length ? cx.courseList : await cx.getCourseList()
    const course = courses.find(c => String(c.courseId) === input.courseId && String(c.classId) === String(activity.clazzId))
    if (!course || (activity.courseId && String(activity.courseId) !== input.courseId))
      throw createError({ statusCode: 400, message: '活动与课程不匹配，请刷新后重新选择' })
    const kind = manualSignKind(activity)
    if (kind === 'qr' || kind === 'unknown') throw createError({ statusCode: 400, message: '此活动请使用扫码入口' })
    let photo: ReturnType<typeof decodeSignPhoto> | undefined
    if (kind === 'photo') {
      try { photo = decodeSignPhoto(input.photo) }
      catch (error) { throw createError({ statusCode: 400, message: (error as Error).message }) }
    }
    if (kind === 'location' && !isQrCoordinates(input.location))
      throw createError({ statusCode: 400, message: '请先选择地点或获取当前位置' })
    if ((kind === 'code' || kind === 'gesture') && (typeof input.signCode !== 'string' || !/^\d{1,16}$/.test(input.signCode)))
      throw createError({ statusCode: 400, message: '请输入有效的签到码或手势数字轨迹' })
    const status = await cx.preSign(course, activity)
    let result = status
    if (!result) {
      if (kind === 'photo') result = await cx.signPhoto(activity, await uploadSignPhoto(cx.http, input.uid, photo!))
      else if (kind === 'location') result = await cx.signLocation(activity, await resolveClientSignLocation(input.location!))
      else if (kind === 'code') result = await cx.signCode(activity, input.signCode!)
      else if (kind === 'gesture') result = await cx.signGesture(activity, input.signCode!)
      else result = await cx.signNormal(activity)
    }
    return { activity, course, result, kind }
  }
  finally { active.delete(input.uid) }
}
