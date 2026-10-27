export function getMapConfig() {
  const provider = process.env.MAP_PROVIDER?.trim() || 'baidu'
  if (provider !== 'baidu' && provider !== 'osm')
    throw createError({ statusCode: 503, message: '地图服务配置无效，请管理员检查 MAP_PROVIDER' })
  return {
    provider,
    browserAk: provider === 'baidu' ? process.env.BAIDU_MAP_BROWSER_AK?.trim() || '' : '',
    searchReady: provider === 'osm' || Boolean(process.env.BAIDU_MAP_SERVER_AK?.trim()),
  }
}
