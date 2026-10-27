import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createPinia } from 'pinia'
import Editor from '../components/LocationLibraryModal.client.vue'
import { useLocationsStore } from '../stores/locations'
let app: Vue.App
let container: HTMLDivElement
let state: any
let library: ReturnType<typeof useLocationsStore>
const close = vi.fn()
beforeEach(() => {
  localStorage.clear(); close.mockReset()
  for (const [name, value] of Object.entries({ ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, nextTick: Vue.nextTick, useMessage: () => ({ error: vi.fn(), success: vi.fn() }) })) vi.stubGlobal(name, value)
  const pinia = createPinia()
  library = useLocationsStore(pinia); library.activate('editor-user')
  container = document.createElement('div'); document.body.append(container)
  app = Vue.createApp({ render: () => Vue.h(Editor, { show: true, startAdding: true, 'onUpdate:show': close, ref: (instance: any) => { if (instance) state = instance.$.setupState } }) })
  app.use(pinia); app.config.warnHandler = () => {}
  const wrapper = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) })
  for (const name of ['NModal', 'NButton', 'NInput', 'NForm', 'NFormItem', 'NSelect', 'NAlert']) app.component(name, wrapper)
  app.component('LocationMap', { render: () => null })
  app.mount(container)
})
afterEach(() => { app.unmount(); container.remove(); vi.unstubAllGlobals() })
it('opens the map first and saves a named map point as the shared selected location', () => {
  expect(state.inputMode).toBe('map')
  state.pickMap({ longitude: 113.09, latitude: 22.6, coordinateSystem: 'wgs84', name: '图书馆', address: '校园内' })
  state.save(true)
  expect(library.selected).toMatchObject({ name: '图书馆', longitude: 113.09, coordinateSystem: 'wgs84' })
  expect(close).toHaveBeenCalledWith(false)
})
it('does not silently save an old point when replacement pasted coordinates are invalid', async () => {
  state.pickMap({ longitude: 113.09, latitude: 22.6, coordinateSystem: 'wgs84', name: '图书馆' })
  state.setInputMode('paste'); state.coordinatePair = '113.1,22.7'; await Vue.nextTick()
  state.coordinatePair = 'invalid'; await Vue.nextTick(); state.save(true)
  expect(library.locations).toHaveLength(0); expect(close).not.toHaveBeenCalled()
  expect(state.formError).not.toBe('')
})
it('keeps the explicitly chosen source when parsing pasted coordinates', async () => {
  state.setInputMode('paste'); state.draft.name = '百度地点'; state.draft.coordinateSystem = 'bd09'
  state.coordinatePair = '113.09,22.60'; await Vue.nextTick(); state.save(true)
  expect(library.selected?.coordinateSystem).toBe('bd09')
})
