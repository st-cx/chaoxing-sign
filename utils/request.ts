import { createDiscreteApi } from 'naive-ui'

let message: ReturnType<typeof createDiscreteApi>['message'] | undefined

export function getHeaders(defaultHeaders: HeadersInit = {}) {
  // ofetch normalizes request headers to a Headers instance before onRequest.
  // Spreading that instance drops every header, including x-qr-client-id.
  return new Headers(defaultHeaders)
}

const _fetch = $fetch.create({
  async onRequest({ options }) {
    options.headers = getHeaders(options.headers)
  },
  async onResponse() {
  },
  async onResponseError({ response, options }) {
    const state = response._data?.data
    if (state?.code === 'CX_SESSION_EXPIRED' && state.uid && state.lastLoginTime
      && typeof useAccountStore !== 'undefined') {
      useAccountStore().applyAccountSession({ uid: state.uid, loginExpired: true, lastLoginTime: state.lastLoginTime })
    }
    if (!options?.params?.noMessage && typeof window !== 'undefined') {
      try {
        message ??= createDiscreteApi(['message']).message
        message.error(response._data?.message || '服务器错误')
      }
      catch { console.warn('[request] 无法显示错误提示') }
    }
  },
})

const request = _fetch
// export const request = (...args: Parameters<typeof _fetch>): ReturnType<typeof _fetch> => _fetch(...args)
export default request
