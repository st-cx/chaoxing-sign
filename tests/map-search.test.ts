import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { photonPlaces } from '../utils/mapPlaces'
const response = { features: [{ geometry: { coordinates: [113.09, 22.6] }, properties: { name: '图书馆', city: '江门', country: '中国' } }] }
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('BAIDU_MAP_SERVER_AK', ''); vi.stubEnv('MAP_PHOTON_ENDPOINT', ''); vi.stubEnv('MAP_PROVIDER', ''); vi.stubEnv('BAIDU_MAP_BROWSER_AK', '')
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
  vi.stubEnv('MAP_PROVIDER', 'osm')
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 0, results: [{ name: '教学楼', address: '校园内', location: { lng: 113.1, lat: 22.7 } }] }) }))
  const handler = (await import('../server/api/maps/geocode.get')).default as any
  const result = await handler({ session: { uid: 'u' }, query: { address: '教学楼' } })
  expect(result.data.places[0]).toMatchObject({ longitude: 113.1, latitude: 22.7, coordinateSystem: 'bd09' })
})

it('does not fall back to overseas search when the domestic provider lacks a key', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  const handler = (await import('../server/api/maps/geocode.get')).default as any
  await expect(handler({ session: { uid: 'u' }, query: { address: '五邑大学南主楼' } })).rejects.toMatchObject({ statusCode: 503 })
  expect(fetcher).not.toHaveBeenCalled()
})
it('uses domestic POI search for building names and never returns an upstream secret', async () => {
  vi.stubEnv('BAIDU_MAP_SERVER_AK', 'private-test-key')
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 302, message: 'private-test-key denied' }) })
  vi.stubGlobal('fetch', fetcher)
  const handler = (await import('../server/api/maps/geocode.get')).default as any
  await expect(handler({ session: { uid: 'u' }, query: { address: '五邑大学南主楼' } })).rejects.toThrow('百度地点搜索未获授权')
  const url = fetcher.mock.calls[0][0] as URL
  expect(url.hostname).toBe('api.map.baidu.com')
  expect(url.pathname).toBe('/place/v2/search')
  expect(url.searchParams.get('query')).toBe('五邑大学南主楼')
})
it('requires login for configuration and exposes only the browser key', async () => {
  vi.stubEnv('BAIDU_MAP_SERVER_AK', 'secret-server-key')
  vi.stubEnv('BAIDU_MAP_BROWSER_AK', 'public-browser-key')
  vi.stubGlobal('setHeader', vi.fn())
  const handler = (await import('../server/api/maps/config.get')).default as any
  await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
  const response = await handler({ session: { uid: 'u' } })
  expect(response.data).toEqual({ provider: 'baidu', browserAk: 'public-browser-key', searchReady: true })
  expect(JSON.stringify(response)).not.toContain('secret-server-key')
})
