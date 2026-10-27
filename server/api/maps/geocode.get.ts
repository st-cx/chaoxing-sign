import { getServerSession } from '#auth'
import { isQrCoordinates } from '~/utils/qrLocation'
import { photonPlaces, type MapPlace } from '~/utils/mapPlaces'
const cache = new Map<string, { expires: number; places: MapPlace[]; provider: string }>()
let nextRequest = 0
export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.uid) throw createError({ statusCode: 401, message: '请先登录本站' })
  const address = String(getQuery(event).address || '').trim()
  if (!address || Buffer.byteLength(address, 'utf8') > 128)
    throw createError({ statusCode: 400, message: '请输入简短、完整的学校或地点地址' })
  const saved = cache.get(address)
  if (saved && saved.expires > Date.now()) return ResOp.success(saved)
  if (Date.now() < nextRequest) throw createError({ statusCode: 429, message: '搜索稍频繁，请稍后重试' })
  nextRequest = Date.now() + 1100
  const ak = process.env.BAIDU_MAP_SERVER_AK
  try {
    const url = ak ? new URL('https://api.map.baidu.com/geocoding/v3/') : new URL(process.env.MAP_PHOTON_ENDPOINT || 'https://photon.komoot.io/api/')
    url.search = ak ? new URLSearchParams({ address, output: 'json', ak }).toString() : new URLSearchParams({ q: address, limit: '6' }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error('http')
    const body = await response.json()
    let places: MapPlace[]
    if (ak) {
      const location = { longitude: body.result?.location?.lng, latitude: body.result?.location?.lat, coordinateSystem: 'bd09' as const }
      if (body.status !== 0 || !isQrCoordinates(location)) throw new Error('result')
      places = [{ ...location, name: address.slice(0, 60), address }]
    }
    else places = photonPlaces(body)
    const result = { places, provider: ak ? '百度地图' : 'Photon / OpenStreetMap', expires: Date.now() + 10 * 60_000 }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(address, result)
    return ResOp.success(result)
  }
  catch { throw createError({ statusCode: 502, message: '地点搜索暂时不可用，可直接点击地图选点，或稍后重试' }) }
})
