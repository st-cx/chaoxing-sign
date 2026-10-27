import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref, watch, createApp } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { defaultSetting } from '../constants/setting'

const request = vi.fn()
const log = vi.fn()
beforeEach(() => {
  setActivePinia(createPinia())
  request.mockReset()
  log.mockReset()
  for (const [name, value] of Object.entries({ computed, ref, watch, defineStore, request, useLogStore: () => ({ log }) }))
    vi.stubGlobal(name, value)
})
afterEach(() => vi.unstubAllGlobals())

it('initializes the account store inside app context without creating a message portal', async () => {
  const { useAccountStore } = await import('../stores/account')
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  expect(() => app.runWithContext(() => useAccountStore(pinia))).not.toThrow()
})

it('preserves checkbox choices after syncing and clears expired account selections', async () => {
  const { useAccountStore } = await import('../stores/account')
  const store = useAccountStore()
  store.accounts = [{ uid: 'a', selected: true }, { uid: 'b', selected: true }] as any
  request.mockResolvedValue({ data: [{ uid: 'a', selected: false }, { uid: 'b', selected: false, loginExpired: true }] })
  await store.syncAccounts()
  expect(store.accounts.map(item => item.selected)).toEqual([true, false])
})

it('does not replace settings or report success on a business-level save error', async () => {
  const { useAccountStore } = await import('../stores/account')
  const store = useAccountStore()
  store.accounts = [{ uid: 'a', info: { realname: '同学' }, setting: structuredClone(defaultSetting) }] as any
  request.mockResolvedValue({ code: 204, message: '账号不存在' })
  await expect(store.updateSetting('a', { ...defaultSetting, delay: 900 })).rejects.toThrow('账号不存在')
  expect(store.accounts[0].setting.delay).toBe(defaultSetting.delay)
  expect(log).not.toHaveBeenCalled()
})
