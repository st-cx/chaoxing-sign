import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLocationsStore } from '../stores/locations'
import { parseCoordinatePair, validateLocation } from '../utils/locationLibrary'
import { getClientLocationForQr, getFreshClientLocationForSign, runtimeLocation, setRuntimeLocation } from '../utils/clientLocation.client'
import { browserLocationToBaidu, locationToWgs84, offsetQrLocation } from '../utils/coordinateTransform'
import { isQrCoordinates } from '../utils/qrLocation'
import { createBaiduAddressCache } from '../server/utils/baiduReverseGeocode'

const place = { name: '图书馆', address: '校区东侧', longitude: 113.09, latitude: 22.6, coordinateSystem: 'bd09' as const }
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); setRuntimeLocation(null) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setRuntimeLocation(null) })

describe('coordinate library persistence and run selection', () => {
  it('remembers the chosen location after reload and after switching back to its website user', () => {
    const first = useLocationsStore()
    first.activate('a')
    const id = first.save(place)
    first.select(id)
    first.save({ ...place, longitude: 113.1 }, id)
    setActivePinia(createPinia())
    const next = useLocationsStore()
    next.activate('a')
    expect(next.selected?.name).toBe(place.name)
    expect(runtimeLocation.value?.longitude).toBe(113.1)
    next.activate('b')
    expect(next.selected).toBeUndefined()
    next.activate('a')
    expect(next.selected?.longitude).toBe(113.1)
  })
  it('leaves the current selection unchanged if remembering it fails', () => {
    const store = useLocationsStore(); store.activate('a')
    const id = store.save(place)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => store.select(id)).toThrow('保存失败')
    expect(store.selectedId).toBe('browser')
  })
  it('saves, reloads, selects and updates a position without another geolocation request', async () => {
    const geo = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: geo } })
    const first = useLocationsStore()
    first.activate('user-a')
    first.save(place)
    setActivePinia(createPinia())
    const next = useLocationsStore()
    next.activate('user-a')
    expect(next.locations).toHaveLength(1)
    expect(next.selectedId).toBe('browser')
    const id = next.locations[0].id
    next.select(id)
    expect(await getClientLocationForQr()).toEqual({ longitude: 113.09, latitude: 22.6, coordinateSystem: 'bd09' })
    next.save({ ...place, longitude: 113.1 }, id)
    expect(await getFreshClientLocationForSign()).toEqual({ longitude: 113.1, latitude: 22.6, coordinateSystem: 'bd09' })
    expect(geo).not.toHaveBeenCalled()
    next.remove(id)
    expect(next.selectedId).toBe('browser')
    expect(runtimeLocation.value).toBeNull()
  })

  it('isolates users and resets the current run when signing out', () => {
    const store = useLocationsStore()
    store.activate('a')
    store.select(store.save(place))
    store.activate('b')
    expect(store.locations).toEqual([])
    expect(runtimeLocation.value).toBeNull()
    store.activate('a')
    expect(store.locations[0].name).toBe('图书馆')
    store.activate()
    expect(store.locations).toEqual([])
    expect(() => store.save(place)).toThrow('登录')
  })

  it('validates the entire import before writing and merges duplicate entries', () => {
    const store = useLocationsStore()
    store.activate('a')
    store.save(place)
    const before = store.exportFile()
    expect(() => store.importFile(JSON.stringify({ version: 1, locations: [place, { ...place, latitude: 100 }] }))).toThrow()
    expect(store.exportFile()).toBe(before)
    expect(store.importFile(before)).toBe(0)
    expect(store.importFile(JSON.stringify({ version: 1, locations: [{ ...place, name: '教学楼' }] }))).toBe(1)
    expect(store.locations).toHaveLength(2)
  })

  it('does not report a save or erase the old data when storage fails', () => {
    const store = useLocationsStore()
    store.activate('a')
    store.save(place)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => store.save({ ...place, name: '新位置' })).toThrow('保存失败')
    expect(store.locations).toHaveLength(1)
  })

  it('keeps damaged storage intact rather than overwriting it', () => {
    localStorage.setItem('chaoxing:locations:v1:a', 'damaged')
    const store = useLocationsStore()
    store.activate('a')
    expect(store.error).toContain('原数据未覆盖')
    expect(() => store.save(place)).toThrow()
    expect(localStorage.getItem('chaoxing:locations:v1:a')).toBe('damaged')
  })
})

describe('coordinate input and systems', () => {
  it('positions a saved Baidu point on a WGS84 map without changing the saved data', () => {
    const original = { longitude: 113.09, latitude: 22.6, coordinateSystem: 'wgs84' as const }
    const baidu = { ...browserLocationToBaidu(original), coordinateSystem: 'bd09' as const }
    const map = locationToWgs84(baidu)
    expect(map.longitude).toBeCloseTo(original.longitude, 6)
    expect(map.latitude).toBeCloseTo(original.latitude, 6)
    expect(baidu.coordinateSystem).toBe('bd09')
  })
  it('fills a pasted coordinate pair without swapping longitude and latitude', () => {
    expect(parseCoordinatePair(' 113.1001，22.6102 ')).toEqual({ longitude: '113.1001', latitude: '22.6102' })
    expect(() => parseCoordinatePair('22.6102,113.1001')).toThrow('顺序')
    expect(() => parseCoordinatePair('113.1,,')).toThrow()
  })
  it.each(['', ' ', null, false, 'abc', 'Infinity', 181])('rejects invalid longitude %s instead of coercing it into a usable point', (longitude) => {
    expect(() => validateLocation({ ...place, longitude })).toThrow()
  })
  it('accepts zero and rejects the unset sentinel and unknown coordinate systems', () => {
    expect(validateLocation({ ...place, longitude: '0', latitude: '0' }).longitude).toBe(0)
    expect(() => validateLocation({ ...place, longitude: -1, latitude: -1 })).toThrow()
    expect(isQrCoordinates({ ...place, coordinateSystem: 'gcj02' })).toBe(false)
  })
  it('does not convert Baidu coordinates a second time and preserves the system through the existing offset', () => {
    expect(browserLocationToBaidu(place)).toEqual({ longitude: 113.09, latitude: 22.6 })
    const offset = offsetQrLocation(place, () => 0)
    expect(offset.coordinateSystem).toBe('bd09')
    expect(browserLocationToBaidu(offset).latitude).toBeCloseTo(place.latitude, 8)
    const gps = { longitude: 113.09, latitude: 22.6 }
    expect(browserLocationToBaidu(gps).longitude).not.toBe(gps.longitude)
  })
  it('does not share reverse-geocoding cache entries across different coordinate systems', async () => {
    const reverse = vi.fn().mockResolvedValue('地址')
    const resolve = createBaiduAddressCache(reverse)
    await resolve(place, 'test')
    await resolve({ ...place, coordinateSystem: 'wgs84' }, 'test')
    expect(reverse).toHaveBeenCalledTimes(2)
    expect(reverse.mock.calls[0][0]).toEqual({ longitude: place.longitude, latitude: place.latitude })
  })
})
