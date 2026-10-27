import { getServerSession } from '#auth'
import { getMapConfig } from '~/server/utils/mapConfig'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.uid) throw createError({ statusCode: 401, message: '请先登录本站' })
  setHeader(event, 'Cache-Control', 'no-store')
  // Only the browser AK may be sent to the browser. Never expose the server AK.
  return ResOp.success(getMapConfig())
})
