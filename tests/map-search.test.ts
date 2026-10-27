import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { photonPlaces } from '../utils/mapPlaces'
const response = { features: [{ geometry: { coordinates: [113.09, 22.6] }, properties: { name: '图书馆', city: '江门', country: '中国' } }] }
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('BAIDU_MAP_SERVER_AK', ''); vi.stubEnv('MAP_PHOTON_ENDPOINT', '')
  vi.stubGlobal('defineEventHandler', (handler: any) => handler)
  vi.stubGlobal('getQuery', (event: any) => event.query)
  vi.stubGlobal('createError', (error: any) => Object.assign(new Error(error.message), error))
  vi.stubGlobal('ResOp', { success: (data: any) => ({ code: 200, data }) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('parses longitude/latitude in correct order and discards invalid search positions', () => {
  expect(photonPlaces(response)[0]).toMatchObject({ name: '图书馆', longitude: 113.09, latitude: 22.6, coordinateSystem: 'wgs84' })
  expect(photonPlaces({ features: [{ geometry: { coordinates: [190, 91] } }] })).toEqual([])
})
it('requires a session, performs keyless search, caches results and rate limits new queries', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => response }); vi.stubGlobal('fetch', fetcher)
  const handler = (await import('../server/api/maps/geocode.get')).default as any
  await expect(handler({ query: { address: '图书馆' } })).rejects.toMatchObject({ statusCode: 401 })
  expect(fetcher).not.toHaveBeenCalled()
  const event = { session: { uid: 'u' }, query: { address: '江门图书馆' } }
  const result = await handler(event)
  expect(result.data.places[0].coordinateSystem).toBe('wgs84')
  expect((fetcher.mock.calls[0][0] as URL).searchParams.get('q')).toBe('江门图书馆')
  expect(await handler(event)).toEqual(result); expect(fetcher).toHaveBeenCalledOnce()
  await expect(handler({ ...event, query: { address: '另一个地点' } })).rejects.toMatchObject({ statusCode: 429 })
})
it('keeps Baidu results in BD09 when a deployment key is configured', async () => {
  vi.stubEnv('BAIDU_MAP_SERVER_AK', 'test-key')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 0, result: { location: { lng: 113.1, lat: 22.7 } } }) }))
  const handler = (await import('../server/api/maps/geocode.get')).default as any
  const result = await handler({ session: { uid: 'u' }, query: { address: '教学楼' } })
  expect(result.data.places[0]).toMatchObject({ longitude: 113.1, latitude: 22.7, coordinateSystem: 'bd09' })
})
