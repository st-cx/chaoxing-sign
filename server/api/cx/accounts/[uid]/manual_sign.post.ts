import { executeManualSign, requireOwnedSignAccount, type ManualSignInput } from '~/server/utils/manualSign'
import { createSignLog } from '~/server/utils/createSignLog'
import { SignMode } from '~/constants/cx'

export default defineEventHandler(async (event) => {
  const input = await readBody<ManualSignInput>(event)
  const uid = String(event.context.params?.uid || '')
  if (!uid || input?.uid !== uid) throw createError({ statusCode: 400, message: '账号不匹配' })
  const cx = await requireOwnedSignAccount(event, uid)
  const data = await executeManualSign(cx, input)
  await createSignLog(cx, event.context.prisma, {
    activityId: String(data.activity.id), activityName: data.activity.name,
    courseId: data.course.courseId, classId: data.course.classId, courseName: data.course.name,
    type: Number(data.activity.otherId), mode: SignMode.Manual, result: data.result,
  })
  return ResOp.success(data)
})
