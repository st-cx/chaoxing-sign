import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import ActivityCenter from '../components/ActivityCenterModal.client.vue'

let app: Vue.App | undefined
let container: HTMLDivElement
let state: any
const request = vi.fn()
const course = { courseId: '1001', classId: '2001', name: '示例课程' }
const activities = [
  { id: '1', name: '课堂照片', otherId: 0, ifPhoto: 1, course },
  { id: '2', name: '数字签到', otherId: 5, ifPhoto: 0, course },
]
const file = () => new File(['photo fixture'], 'class.png', { type: 'image/png' })

beforeEach(() => {
  request.mockReset().mockImplementation(async (url: string) => url.endsWith('/activities')
    ? { code: 200, data: { activities: structuredClone(activities) } }
    : { code: 200, data: { result: '签到成功' } })
  for (const [name, value] of Object.entries({ ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, onBeforeUnmount: Vue.onBeforeUnmount, useAccountStore: () => ({}), request }))
    vi.stubGlobal(name, value)
  container = document.createElement('div'); document.body.append(container)
})
afterEach(() => { app?.unmount(); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function mount() {
  app = Vue.createApp({ render: () => Vue.h(ActivityCenter, {
    show: true, uid: '123', name: '示例账号', initialType: 'photo',
    ref: (instance: any) => { if (instance) state = instance.$.setupState },
  }) })
  app.config.warnHandler = () => {}
  const wrapper = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('div', slots.default?.()) })
  for (const name of ['NModal', 'NSpin', 'NButton', 'NInput', 'NAlert', 'NEmpty']) app.component(name, wrapper)
  for (const name of ['LocationPicker', 'QrCodeSignModal']) app.component(name, { render: () => null })
  app.mount(container)
  await vi.waitFor(() => expect(state.selectedId).toBe('1'))
}

it('loads photo activities and previews a file locally before explicit submission', async () => {
  await mount()
  await state.submit()
  expect(state.error).toContain('请先选择')
  expect(request).toHaveBeenCalledTimes(1)
  await state.readPhoto(file()); await Vue.nextTick()
  expect(container.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
  expect(request).toHaveBeenCalledTimes(1)
  await state.submit()
  expect(request.mock.calls[1][1].body).toMatchObject({ uid: '123', activityId: '1', courseId: '1001', photo: state.photo })
  await state.submit()
  expect(request).toHaveBeenCalledTimes(2)
})

it('prevents duplicate uploads, preserves the photo on failure and allows a retry', async () => {
  await mount(); await state.readPhoto(file())
  let reject!: (error: Error) => void
  request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  const pending = state.submit(); await state.submit()
  expect(request).toHaveBeenCalledTimes(2)
  reject(new Error('网络暂不可用')); await pending
  expect(state.photoName).toBe('class.png'); expect(state.error).toBe('网络暂不可用')
  await state.submit(); expect(state.done).toBe(true)
})

it('clears old photo material on activity change and ignores a late file read', async () => {
  await mount()
  const readers: any[] = []
  vi.stubGlobal('FileReader', class { result = 'data:image/png;base64,late'; onload: any; readAsDataURL() { readers.push(this) } })
  const reading = state.readPhoto(file())
  state.filter = 'code'; await Vue.nextTick()
  expect(state.selectedId).toBe('2')
  readers[0].onload(); await reading
  expect(state.photo).toBe(''); expect(state.photoLoading).toBe(false)
  state.signCode = '1234'; await state.submit()
  expect(request.mock.calls[1][1].body).toMatchObject({ activityId: '2', signCode: '1234' })
  expect(request.mock.calls[1][1].body).not.toHaveProperty('photo')
})

it('rejects an invalid replacement instead of accidentally keeping the previous photo', async () => {
  await mount(); await state.readPhoto(file())
  await state.readPhoto(new File(['text'], 'bad.svg', { type: 'image/svg+xml' }))
  expect(state.photo).toBe(''); expect(state.error).toContain('JPG')
  await state.submit(); expect(request).toHaveBeenCalledTimes(1)
})

it('drops the draft if a refreshed activity has ended or changed its required material', async () => {
  await mount(); await state.readPhoto(file())
  request.mockResolvedValueOnce({ code: 200, data: { activities: [] } })
  await state.refresh()
  expect(state.selectedId).toBe(''); expect(state.photo).toBe('')
  await state.submit(); expect(request).toHaveBeenCalledTimes(2)
})
