<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { browserLocationToBaidu, locationToWgs84 } from '~/utils/coordinateTransform'
import { loadBaiduMap } from '~/utils/baiduMap.client'
import { isQrCoordinates, type QrCoordinates } from '~/utils/qrLocation'
import type { MapPlace } from '~/utils/mapPlaces'
const props = defineProps<{ value?: QrCoordinates }>()
const emit = defineEmits<{ (e: 'select', value: QrCoordinates & { name?: string; address?: string }): void }>()
const canvas = ref<HTMLElement>()
const address = ref('')
const searching = ref(false)
const loadingMap = ref(true)
const error = ref('')
const mapError = ref('')
const tileError = ref(false)
const results = ref<MapPlace[]>([])
const provider = ref('')
const config = ref<{ provider: 'baidu' | 'osm'; browserAk: string; searchReady: boolean }>()
const setupRequired = computed(() => config.value?.provider === 'baidu' && !config.value.browserAk)
let map: any
let marker: any
let leaflet: any
let baidu: any
let clickHandler: any
let disposed = false
let run = 0
function showPoint(value: QrCoordinates) {
  if (!map) return
  if (baidu) {
    const point = browserLocationToBaidu(value)
    const latlng = new baidu.Point(point.longitude, point.latitude)
    if (marker) marker.setPosition(latlng)
    else { marker = new baidu.Marker(latlng); map.addOverlay(marker) }
    map.centerAndZoom(latlng, Math.max(map.getZoom(), 17))
  }
  else if (leaflet) {
    const point = locationToWgs84(value)
    const latlng = [point.latitude, point.longitude]
    if (marker) marker.setLatLng(latlng)
    else marker = leaflet.circleMarker(latlng, { radius: 9, color: '#0c7668', weight: 3, fillColor: '#41ccb2', fillOpacity: 0.9 }).addTo(map)
    map.setView(latlng, Math.max(map.getZoom(), 16))
  }
}
function selectPoint(longitude: number, latitude: number, coordinateSystem: 'bd09' | 'wgs84') {
  const value = { longitude, latitude, coordinateSystem }
  if (disposed || !isQrCoordinates(value)) return
  value.longitude = Number(longitude.toFixed(6)); value.latitude = Number(latitude.toFixed(6))
  emit('select', value); showPoint(value)
}
onMounted(async () => {
  try {
    const result = await request('/api/maps/config')
    if (disposed) return
    if (result.code !== 200) throw new Error('未能读取地图配置，请刷新重试')
    config.value = result.data
    await nextTick()
    if (!canvas.value || setupRequired.value) return
    if (config.value?.provider === 'baidu') {
      baidu = await loadBaiduMap(config.value.browserAk)
      if (disposed || !canvas.value) return
      map = new baidu.Map(canvas.value)
      map.centerAndZoom(new baidu.Point(104.19, 35.86), 5)
      map.addControl(new baidu.ScaleControl())
      map.addControl(new baidu.ZoomControl())
      clickHandler = (event: any) => {
        const point = event.point || event.latlng
        if (point) selectPoint(point.lng, point.lat, 'bd09')
      }
      map.addEventListener('click', clickHandler)
    }
    else if (config.value?.provider === 'osm') {
      // Overseas deployment option only. Never silently fall back after a domestic failure.
      leaflet = await import('leaflet')
      if (disposed || !canvas.value) return
      map = leaflet.map(canvas.value, { scrollWheelZoom: false }).setView([35.86, 104.19], 4)
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' })
        .on('tileerror', () => { tileError.value = true }).addTo(map)
      map.on('click', (event: any) => selectPoint(event.latlng.lng, event.latlng.lat, 'wgs84'))
      map.invalidateSize()
    }
    else throw new Error('地图服务配置无效，请联系管理员')
    if (props.value) showPoint(props.value)
  }
  catch (failure) { if (!disposed) mapError.value = (failure as Error).message || '地图加载失败，请联系管理员' }
  finally { if (!disposed) loadingMap.value = false }
})
watch(() => props.value, value => { if (value) showPoint(value) })
onBeforeUnmount(() => {
  disposed = true; run++
  if (baidu && map) { map.removeEventListener('click', clickHandler); map.destroy?.() }
  else map?.remove()
})
async function search() {
  if (!address.value.trim() || searching.value || !config.value?.searchReady) return
  const current = ++run
  searching.value = true; error.value = ''; results.value = []
  try {
    const result = await request('/api/maps/geocode', { params: { address: address.value.trim() } })
    if (disposed || current !== run) return
    if (result.code !== 200) throw new Error(result.message || '搜索失败')
    results.value = result.data.places || []
    provider.value = result.data.provider || ''
    if (!results.value.length) error.value = '没有找到匹配地点，试试“江门 五邑大学 南主楼”等城市＋学校＋楼名，或在地图上选点'
  }
  catch (failure) { if (!disposed && current === run) error.value = (failure as any)?.data?.message || (failure as Error).message }
  finally { if (current === run) searching.value = false }
}
function choosePlace(place: MapPlace) { emit('select', place); showPoint(place); results.value = [] }
</script>
<template>
  <div class="map-picker">
    <div v-if="setupRequired || (config && !config.searchReady)" class="map-setup-notice" role="status">
      <strong>{{ setupRequired ? '地图等待管理员启用' : '地点搜索等待管理员启用' }}</strong>
      <p>本站使用百度地图。完成地图服务配置后，即可搜索楼名、点击选点并保存；现在仍可使用已有地点、当前位置或粘贴坐标。</p>
      <a href="/help#地图服务配置" target="_blank" rel="noopener noreferrer">查看申请与配置步骤 ↗</a>
    </div>
    <div class="coordinate-paste"><n-input v-model:value="address" placeholder="输入城市、学校或完整地址" :disabled="!config?.searchReady" @keydown.enter.prevent="search" /><n-button :loading="searching" :disabled="!address.trim() || !config?.searchReady" @click="search">搜索地点</n-button></div>
    <p v-if="loadingMap" class="location-note" role="status">正在加载地图…</p>
    <p v-else-if="!setupRequired && !mapError" class="location-note">点击地图选点，可放大到具体楼栋。选好后在下方命名并保存。</p>
    <div v-if="results.length" class="map-search-results"><button v-for="(place, index) in results" :key="index" type="button" @click="choosePlace(place)"><strong>{{ place.name }}</strong><small>{{ place.address }}</small></button></div>
    <div v-show="config && !setupRequired && !mapError" ref="canvas" class="location-map-canvas" aria-label="点击地图选择地点" />
    <small v-if="provider" class="location-note">搜索来源：{{ provider }}</small>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <p v-if="mapError" role="alert" class="form-error">{{ mapError }}</p>
    <p v-if="tileError" class="location-note">OpenStreetMap 未能提供地图瓦片，请管理员检查服务配置；国内部署建议使用百度地图。</p>
  </div>
</template>
