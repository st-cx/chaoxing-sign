let loading: Promise<any> | undefined
let loadId = 0

// Official JSAPI 4.0 async script entry point; no public/shared keys or tile proxies.
export function loadBaiduMap(ak: string): Promise<any> {
  if (!ak.trim()) return Promise.reject(new Error('请先配置百度地图浏览器端 AK'))
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const scope = window as any
    const callback = `__chaoxingBaiduMapReady${++loadId}`
    const script = document.createElement('script')
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      // Keep a no-op for a late callback after a timeout.
      scope[callback] = () => {}
      script.onerror = null
      if (error) { script.remove(); loading = undefined; reject(error) }
      else resolve(scope.BMap)
    }
    const timer = setTimeout(() => finish(new Error('百度地图加载超时，请检查浏览器端 AK、域名白名单或网络')), 15_000)
    scope[callback] = () => finish(scope.BMap?.Map ? undefined : new Error('百度地图未能初始化，请检查浏览器端 AK 配置'))
    script.async = true
    script.referrerPolicy = 'strict-origin-when-cross-origin'
    const url = new URL('https://api.map.baidu.com/api')
    url.search = new URLSearchParams({ v: '4.0', ak, callback }).toString()
    script.src = url.toString()
    script.onerror = () => finish(new Error('百度地图加载失败，请检查浏览器端 AK、域名白名单或网络'))
    document.head.append(script)
  })
  return loading
}
