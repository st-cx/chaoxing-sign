import { afterEach, beforeEach, expect, it, vi } from 'vitest'
beforeEach(() => { vi.resetModules(); vi.useFakeTimers() })
afterEach(() => {
  vi.useRealTimers()
  for (const node of document.querySelectorAll('script')) node.remove()
  delete (window as any).BMap
})
it('rejects an empty key without sending a request', async () => {
  const { loadBaiduMap } = await import('../utils/baiduMap.client')
  await expect(loadBaiduMap('')).rejects.toThrow('浏览器端 AK')
  expect(document.querySelector('script')).toBeNull()
})
it('shares a single official SDK load and resolves only after its callback', async () => {
  const { loadBaiduMap } = await import('../utils/baiduMap.client')
  const loading = loadBaiduMap('browser-test-key')
  expect(loadBaiduMap('browser-test-key')).toBe(loading)
  const script = document.querySelector('script')!
  const url = new URL(script.src)
  expect(url.hostname).toBe('api.map.baidu.com')
  expect(url.searchParams.get('v')).toBe('4.0')
  ;(window as any).BMap = { Map: function () {} }
  ;(window as any)[url.searchParams.get('callback')!] ()
  await expect(loading).resolves.toBe((window as any).BMap)
})
it('allows retry after timeout and ignores a late callback from the old load', async () => {
  const { loadBaiduMap } = await import('../utils/baiduMap.client')
  const first = loadBaiduMap('browser-test-key')
  const oldCallback = new URL(document.querySelector('script')!.src).searchParams.get('callback')!
  const failed = expect(first).rejects.toThrow('超时')
  await vi.advanceTimersByTimeAsync(15_000); await failed
  const second = loadBaiduMap('browser-test-key')
  let resolved = false; void second.then(() => { resolved = true })
  ;(window as any)[oldCallback]()
  await Promise.resolve(); expect(resolved).toBe(false)
  const callback = new URL(document.querySelector('script')!.src).searchParams.get('callback')!
  ;(window as any).BMap = { Map: function () {} }
  ;(window as any)[callback]()
  await second
})
