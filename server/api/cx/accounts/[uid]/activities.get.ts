import { mapLimit } from 'async'
import { requireOwnedSignAccount } from '~/server/utils/manualSign'

export default defineEventHandler(async (event) => {
  const uid = String(event.context.params?.uid || '')
  const cx = await requireOwnedSignAccount(event, uid)
  const courses = await cx.getCourseList()
  const warnings: string[] = []
  const groups = await mapLimit(courses, 3, async (course: CX.Course) => {
    try {
      const list = (await cx.getActivityList(course)).filter(a => Number(a.type) === 2 && Number(a.status) === 1)
      const details = []
      for (const item of list) {
        try { details.push({ ...item, ...await cx.getActivityDetail(item.id), course }) }
        catch { warnings.push(`${course.name}：部分活动详情加载失败，请刷新重试`) }
      }
      return details
    }
    catch { warnings.push(`${course.name}：活动加载失败，请刷新重试`); return [] }
  })
  setHeader(event, 'Cache-Control', 'no-store')
  return ResOp.success({ activities: groups.flat(), warnings })
})
