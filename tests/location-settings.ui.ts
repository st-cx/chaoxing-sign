import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SettingModal from '../components/SettingModal.client.vue'
import { defaultSetting } from '../constants/setting'

let app: Vue.App | undefined
let container: HTMLDivElement
let state: any
const save = vi.fn()
const error = vi.fn()
const close = vi.fn()
beforeEach(() => {
  setActivePinia(createPinia())
  save.mockReset().mockResolvedValue(undefined)
  error.mockReset()
  close.mockReset()
  for (const [name, value] of Object.entries({ ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, useAccountStore: () => ({ updateSetting: save }), useMessage: () => ({ error }) }))
    vi.stubGlobal(name, value)
  container = document.createElement('div')
  document.body.append(container)
})
afterEach(() => { app?.unmount(); container.remove(); vi.unstubAllGlobals() })

function mount(setting: any) {
  app = Vue.createApp({ render: () => Vue.h(SettingModal, {
    show: true, uid: 'a', setting, 'onUpdate:show': close,
    ref: (instance: any) => { if (instance) state = instance.$.setupState },
  }) })
  app.use(createPinia())
  app.config.warnHandler = () => {}
  const wrapper = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) })
  for (const name of ['NModal', 'NSpin', 'NForm', 'NFormItem', 'NSpace', 'NButton', 'NCheckboxGroup', 'NPopconfirm'])
    app.component(name, wrapper)
  app.component('LocationLibraryModal', { render: () => null })
  app.mount(container)
}

it('keeps edits and reset drafts separate from account settings and the shared defaults', async () => {
  const original = structuredClone(defaultSetting)
  mount(original)
  state.form.location.text = '尚未保存'
  state.form.signType.pop()
  expect(original).toEqual(defaultSetting)
  state.handleReset()
  state.form.location.text = '修改重置草稿'
  expect(defaultSetting.location.text).toBe('')
  state.show = false
  expect(close).toHaveBeenCalledWith(false)
  expect(save).not.toHaveBeenCalled()
})

it('retains the draft on failure, prevents duplicate saves, and closes only after success', async () => {
  mount(structuredClone(defaultSetting))
  state.form.location = { text: '图书馆', longitude: '113.09', latitude: '22.6' }
  let reject!: (error: Error) => void
  save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  const pending = state.handleSave()
  await state.handleSave()
  expect(save).toHaveBeenCalledTimes(1)
  reject(new Error('保存失败'))
  await pending
  expect(close).not.toHaveBeenCalled()
  expect(state.form.location.text).toBe('图书馆')
  expect(error).toHaveBeenCalledWith('保存失败')
  await state.handleSave()
  expect(close).toHaveBeenCalledWith(false)
  expect(save.mock.calls[1][1].location.text).toBe('图书馆')
})

it('does not send invalid coordinates', async () => {
  mount(structuredClone(defaultSetting))
  state.form.location.longitude = ''
  await state.handleSave()
  expect(save).not.toHaveBeenCalled()
  expect(error).toHaveBeenCalled()
})
