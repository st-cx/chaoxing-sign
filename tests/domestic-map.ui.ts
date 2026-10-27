import * as Vue from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LocationMap from '../components/LocationMap.client.vue'

const { sdk, handlers, mockMap, point, marker } = vi.hoisted(() => ({
  sdk: vi.fn(), handlers: {} as Record<string, Function>,
  mockMap: { centerAndZoom: vi.fn(), getZoom: () => 17, addOverlay: vi.fn(), addControl: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), destroy: vi.fn() },
  point: vi.fn(function (this: any, lng, lat) { this.lng = lng; this.lat = lat }),
  marker: vi.fn(function (this: any) { this.setPosition = vi.fn() }),
}))
vi.mock('../utils/baiduMap.client', () => ({ loadBaiduMap: sdk }))
let app: Vue.App, container: HTMLDivElement
const request = vi.fn(), select = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  for (const [name, value] of Object.entries({ ...Vue, request })) vi.stubGlobal(name, value)
  mockMap.addEventListener.mockImplementation((name, handler) => { handlers[name] = handler })
  sdk.mockResolvedValue({ Map: function () { return mockMap }, Point: point, Marker: marker, ScaleControl: function () {}, ZoomControl: function () {} })
  container = document.createElement('div'); document.body.append(container)
})
afterEach(() => { app?.unmount(); container.remove(); vi.unstubAllGlobals() })
async function mount(value?: any) {
  app = Vue.createApp({ render: () => Vue.h(LocationMap, { value, onSelect: select }) })
  app.component('NInput', { render: () => Vue.h('input') })
  app.component('NButton', { render() { return Vue.h('button', this.$attrs, this.$slots.default?.()) } })
  app.mount(container)
  await vi.waitFor(() => expect(container.textContent).not.toContain('正在加载地图'))
}
it('shows setup help without loading any map SDK when domestic keys are missing', async () => {
  request.mockResolvedValue({ code: 200, data: { provider: 'baidu', browserAk: '', searchReady: false } })
  await mount()
  expect(sdk).not.toHaveBeenCalled()
  expect(container.textContent).toContain('地图等待管理员启用')
  expect(container.querySelector('button')?.disabled).toBe(true)
  expect(container.querySelector('.location-map-canvas')?.getAttribute('style')).toContain('display: none')
  expect(request).toHaveBeenCalledTimes(1)
})
it('preserves BD09 clicks and existing markers without a second coordinate conversion', async () => {
  request.mockResolvedValue({ code: 200, data: { provider: 'baidu', browserAk: 'browser-key', searchReady: true } })
  await mount({ longitude: 113.09, latitude: 22.6, coordinateSystem: 'bd09' })
  expect(sdk).toHaveBeenCalledWith('browser-key')
  expect(point).toHaveBeenLastCalledWith(113.09, 22.6)
  handlers.click({ point: { lng: 113.092, lat: 22.603 } })
  expect(select).toHaveBeenCalledWith({ longitude: 113.092, latitude: 22.603, coordinateSystem: 'bd09' })
  app.unmount()
  expect(mockMap.destroy).toHaveBeenCalledOnce()
})
it('reports SDK failure without silently switching to overseas tiles', async () => {
  request.mockResolvedValue({ code: 200, data: { provider: 'baidu', browserAk: 'browser-key', searchReady: true } })
  sdk.mockRejectedValue(new Error('百度地图加载失败，请检查浏览器端 AK、域名白名单或网络'))
  await mount()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('百度地图加载失败')
  expect(container.querySelector('img')).toBeNull()
})
