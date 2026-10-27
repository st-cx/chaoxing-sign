// Isolated visual/interaction preview. Only fixtures are used; no real authentication or sign requests.
import * as Vue from 'vue'
import * as VueUse from '@vueuse/core'
import * as UI from 'naive-ui'
import { createPinia, defineStore } from 'pinia'
import 'virtual:uno.css'
import '../assets/css/preflight.css'
import '../assets/css/main.css'
import '../assets/css/workspace.css'

// Keep async imports outside module evaluation: production chunks share Vue/UI
// exports with this entry, so top-level await would create a circular wait.
async function mountPreview() {
const colorMode = Vue.reactive({ value: localStorage.getItem('preview-theme') || 'light', preference: localStorage.getItem('preview-theme') || 'light' })
Vue.watch(() => colorMode.preference, (value) => { colorMode.value = value; localStorage.setItem('preview-theme', value) })
Vue.watch(() => colorMode.value, value => document.documentElement.classList.toggle('dark', value === 'dark'), { immediate: true })
const vueGlobals = Object.fromEntries(['ref', 'computed', 'reactive', 'watch', 'watchEffect', 'toRef', 'unref', 'onMounted', 'onBeforeUnmount', 'nextTick'].map(name => [name, (Vue as any)[name]]))
Object.assign(globalThis, vueGlobals, VueUse, {
  defineStore,
  useMessage: UI.useMessage,
  useColorMode: () => colorMode,
  useAppConfig: () => ({ title: '某星签到助手' }),
  useRuntimeConfig: () => ({ public: {} }),
  isPhone: (value: string) => /^1\d{10}$/.test(value),
  EventSource: undefined,
  useLazyAsyncData: async (_key: string, fetcher: () => Promise<unknown>) => {
    const data = Vue.ref<unknown>([])
    const pending = Vue.ref(false)
    return { data, pending, refresh: async () => { pending.value = true; try { data.value = await fetcher() } finally { pending.value = false } } }
  },
})
const { defaultSetting } = await import('../constants/setting')
const { useLogStore } = await import('../stores/log')
Object.assign(globalThis, { useLogStore })
const { useAccountStore } = await import('../stores/account')
const { useLocationsStore } = await import('../stores/locations')
Object.assign(globalThis, { useAccountStore, useLocationsStore })
const fixtureAccounts = ['林同学', '陈同学', '访客账号'].map((name, index) => ({
  uid: `demo-${index + 1}`, username: `1380000000${index}`, password: '', cookies: [],
  info: { realname: name, siteName: '示例大学 · 界面演示', username: `1380000000${index}`, avatar: '', logged: index !== 2 },
  setting: { ...structuredClone(defaultSetting), location: { text: '教学楼 A 座', longitude: '113.09', latitude: '22.6' } },
  lastLoginTime: new Date().toISOString(), courses: [], activities: [], selected: index === 0, loginExpired: index === 2,
}))
Object.assign(globalThis, {
  request: async (url: string, options?: { body?: any; params?: any }) => {
    await new Promise(resolve => setTimeout(resolve, 180))
    if (url === '/api/cx/accounts')
      return { code: 200, data: structuredClone(fixtureAccounts) }
    if (url === '/api/cx/recent-signs')
      return { code: 200, data: {} }
    if (url.endsWith('/activities')) {
      const course = { courseId: '1001', classId: '2001', name: '软件工程 · 示例课程', image: '' }
      const kinds = [{ otherId: 0, ifPhoto: 1, name: '课堂拍照签到' }, { otherId: 4, name: '教学楼位置签到' }, { otherId: 5, name: '签到码练习' }, { otherId: 3, name: '手势签到练习' }, { otherId: 0, ifPhoto: 0, name: '普通课堂签到' }]
      return { code: 200, data: { activities: kinds.map((item, index) => ({ ...item, id: 3001 + index, status: 1, activeType: 2, type: 2, clazzId: '2001', course })), warnings: [] } }
    }
    if (url.endsWith('/manual_sign'))
      return { code: 200, data: { result: options?.body?.photo ? '演示完成：已读取照片，未上传或执行真实签到' : '演示完成：未执行真实签到' } }
    if (url === '/api/maps/config')
      return { code: 200, data: { provider: 'baidu', browserAk: '', searchReady: false } }
    if (url === '/api/maps/geocode')
      return { code: 200, data: { provider: '示例搜索（未调用在线搜索接口）', places: [{ name: `示例地点：${options?.params?.address || '学校'}`, address: '示例数据，请勿用于实际位置', longitude: 113.092, latitude: 22.603, coordinateSystem: 'bd09' }] } }
    if (url.endsWith('/update_setting')) {
      const account = fixtureAccounts.find(item => item.uid === options?.body.uid)
      if (account) account.setting = structuredClone(options?.body.setting)
      return { code: 200, data: structuredClone(options?.body.setting) }
    }
    if (url.endsWith('/logout'))
      return { code: 200 }
    if (url === '/api/cx/courses' || url.endsWith('/sign_history'))
      return { code: 200, data: [] }
    throw new Error('这是界面演示：未连接真实账号或签到服务')
  },
})

const modules = import.meta.glob('../components/**/*.vue')
const registered: Record<string, Vue.Component> = {}
for (const name of ['Hero', 'AccountList', 'AccountItem', 'Operation', 'SettingModal.client', 'LocationPicker.client', 'LocationLibraryModal.client', 'LocationMap.client', 'ActivityCenterModal.client', 'QrCodeSignModal.client', 'AccountLoginModal.client', 'CodeOrGestureSignModal.client', 'SignHistory', 'app/Logo', 'app/ThemeSwitcher']) {
  const module = await modules[`../components/${name}.vue`]() as { default: Vue.Component }
  registered[name.replace('app/', 'App').replace('.client', '')] = module.default
}
const Home = (await import('../pages/index.vue')).default
const icons = (await import('./icons.json')).default as Record<string, { body: string; width?: number; height?: number }>

const app = Vue.createApp({
  setup() {
    const library = useLocationsStore()
    library.activate('preview-only')
    if (!localStorage.getItem('preview-initialized')) {
      library.save({ name: '教学楼 A 座', address: '示例校区 · 一层大厅', longitude: 113.09, latitude: 22.6, coordinateSystem: 'bd09' })
      library.save({ name: '图书馆', address: '示例校区 · 北门', longitude: 113.092, latitude: 22.603, coordinateSystem: 'bd09' })
      localStorage.setItem('preview-initialized', 'true')
    }
    return () => Vue.h(UI.NConfigProvider, { locale: UI.zhCN, dateLocale: UI.dateZhCN, theme: colorMode.value === 'dark' ? UI.darkTheme : UI.lightTheme,
      themeOverrides: { common: { primaryColor: colorMode.value === 'dark' ? '#4bc8b2' : '#147d73', primaryColorHover: '#29988b', borderRadius: '10px', fontSize: '14px', heightMedium: '44px' } },
    }, () => [Vue.h(UI.NGlobalStyle), Vue.h(UI.NMessageProvider, null, () => Vue.h('div', { class: 'app-layout' }, [
      Vue.h('header', { class: 'mobile-header' }, Vue.h('div', { class: 'header-content' }, [
        Vue.h(registered.AppLogo, { showTitle: true }), Vue.h('span', { style: 'flex:1' }),
        Vue.h('span', { class: 'location-badge' }, '交互预览 · 示例数据'), Vue.h(registered.AppThemeSwitcher),
      ])),
      Vue.h('main', { class: 'mobile-main' }, Vue.h(Vue.Suspense, null, () => Vue.h(Home))),
    ]))])
  },
})
app.use(createPinia())
for (const [name, component] of Object.entries(UI)) {
  if (/^N[A-Z]/.test(name)) app.component(name, component as Vue.Component)
}
for (const [name, component] of Object.entries(registered)) app.component(name, component)
app.component('ClientOnly', { setup: (_, { slots }) => () => slots.default?.() })
app.component('NuxtLink', {
  props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: '#', onClick: (event: Event) => {
    event.preventDefault()
    UI.createDiscreteApi(['message']).message.info(`界面预览未连接 ${props.to}，完整功能保留在 Nuxt 项目中`)
  } }, slots.default?.()),
})
app.component('Icon', { props: ['name', 'size'], setup: props => () => {
  const icon = icons[props.name]
  return Vue.h('svg', { width: props.size || '1em', height: props.size || '1em', viewBox: `0 0 ${icon?.width || 24} ${icon?.height || 24}`, fill: 'currentColor', 'aria-hidden': 'true', innerHTML: icon?.body || '' })
} })
app.mount('#app')
}

mountPreview().catch((error) => {
  console.error('[preview] Failed to initialize', error)
  const root = document.getElementById('app')
  if (root) root.textContent = '示例预览加载失败。请保留此窗口，检查浏览器控制台，或重新构建预览。'
})
