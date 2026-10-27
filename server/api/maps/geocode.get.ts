import { getServerSession } from '#auth'
import { baiduPlaces, photonPlaces, type MapPlace } from '~/utils/mapPlaces'
import { getMapConfig } from '~/server/utils/mapConfig'
const cache = new Map<string, { expires: number; places: MapPlace[]; provider: string }>()
let nextRequest = 0
export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.uid) throw createError({ statusCode: 401, message: '请先登录本站' })
  const address = String(getQuery(event).address || '').trim()
  if (!address || Buffer.byteLength(address, 'utf8') > 128)
    throw createError({ statusCode: 400, message: '请输入简短、完整的学校或地点地址' })
  const config = getMapConfig()
  if (!config.searchReady)
    throw createError({ statusCode: 503, message: '地点搜索尚未配置，请管理员填写百度地图服务端 AK 并开启地点检索服务' })
  const cacheKey = `${config.provider}:${address}`
  const saved = cache.get(cacheKey)
  if (saved && saved.expires > Date.now()) return ResOp.success(saved)
  if (Date.now() < nextRequest) throw createError({ statusCode: 429, message: '搜索稍频繁，请稍后重试' })
  nextRequest = Date.now() + 1100
  const ak = process.env.BAIDU_MAP_SERVER_AK?.trim() || ''
  let body: any
  try {
    const url = config.provider === 'baidu' ? new URL('https://api.map.baidu.com/place/v2/search') : new URL(process.env.MAP_PHOTON_ENDPOINT || 'https://photon.komoot.io/api/')
    url.search = config.provider === 'baidu'
      ? new URLSearchParams({ query: address, region: '全国', city_limit: 'false', output: 'json', page_size: '6', scope: '1', ak }).toString()
      : new URLSearchParams({ q: address, limit: '6' }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error('http')
    body = await response.json()
  }
  catch { throw createError({ statusCode: 502, message: '地点搜索服务连接失败，请稍后重试，或在已加载的地图上选点' }) }
  if (config.provider === 'baidu' && body?.status !== 0) {
    // Upstream messages and request URLs may contain credentials; return only our own text.
    const limited = [4, 401, 402].includes(Number(body?.status))
    throw createError({ statusCode: 502, message: limited
      ? '百度地点搜索额度或频率受限，请稍后重试或联系管理员'
      : '百度地点搜索未获授权，请管理员检查服务端 AK、地点检索权限及 IP 白名单' })
  }
  const places = config.provider === 'baidu' ? baiduPlaces(body) : photonPlaces(body)
  const result = { places, provider: config.provider === 'baidu' ? '百度地图' : 'Photon / OpenStreetMap', expires: Date.now() + 10 * 60_000 }
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey, result)
  return ResOp.success(result)
})
