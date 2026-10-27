<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { locationToWgs84 } from '~/utils/coordinateTransform'
import type { QrCoordinates } from '~/utils/qrLocation'
import type { MapPlace } from '~/utils/mapPlaces'
const props = defineProps<{ value?: QrCoordinates }>()
const emit = defineEmits<{ (e: 'select', value: QrCoordinates & { name?: string; address?: string }): void }>()
const canvas = ref<HTMLElement>()
const address = ref('')
const searching = ref(false)
const error = ref('')
const tileError = ref(false)
const results = ref<MapPlace[]>([])
const provider = ref('')
let map: any
let marker: any
let leaflet: any
let disposed = false
let run = 0
function showPoint(value: QrCoordinates) {
  if (!map || !leaflet) return
  const point = locationToWgs84(value)
  const latlng = [point.latitude, point.longitude]
  if (marker) marker.setLatLng(latlng)
  else marker = leaflet.circleMarker(latlng, { radius: 9, color: '#0c7668', weight: 3, fillColor: '#41ccb2', fillOpacity: 0.9 }).addTo(map)
  map.setView(latlng, Math.max(map.getZoom(), 16))
}
onMounted(async () => {
  try {
    leaflet = await import('leaflet')
    if (disposed || !canvas.value) return
    map = leaflet.map(canvas.value, { scrollWheelZoom: false }).setView([35.86, 104.19], 4)
    leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' })
      .on('tileerror', () => { tileError.value = true }).addTo(map)
    map.on('click', (event: any) => {
      const value = { longitude: Number(event.latlng.lng.toFixed(6)), latitude: Number(event.latlng.lat.toFixed(6)), coordinateSystem: 'wgs84' as const }
      emit('select', value); showPoint(value)
    })
    if (props.value) showPoint(props.value)
    map.invalidateSize()
  }
  catch { error.value = '地图组件未能加载，仍可粘贴坐标或获取当前位置' }
})
watch(() => props.value, value => { if (value) showPoint(value) })
onBeforeUnmount(() => { disposed = true; run++; map?.remove() })
async function search() {
  if (!address.value.trim() || searching.value) return
  const current = ++run
  searching.value = true; error.value = ''; results.value = []
  try {
    const result = await request('/api/maps/geocode', { params: { address: address.value.trim() } })
    if (disposed || current !== run) return
    if (result.code !== 200) throw new Error(result.message || '搜索失败')
    results.value = result.data.places || []
    provider.value = result.data.provider || ''
    if (!results.value.length) error.value = '没有找到匹配地点，可补充城市或学校全名，或直接点击地图'
  }
  catch (failure) { if (!disposed && current === run) error.value = (failure as any)?.data?.message || (failure as Error).message }
  finally { if (current === run) searching.value = false }
}
function choosePlace(place: MapPlace) { emit('select', place); showPoint(place); results.value = [] }
</script>
<template>
  <div class="map-picker">
    <div class="coordinate-paste"><n-input v-model:value="address" placeholder="输入城市、学校或完整地址" @keydown.enter.prevent="search" /><n-button :loading="searching" :disabled="!address.trim()" @click="search">搜索地点</n-button></div>
    <p class="location-note">点击地图选点，可放大到具体楼栋。选好后在下方命名并保存。</p>
    <div v-if="results.length" class="map-search-results"><button v-for="(place, index) in results" :key="index" type="button" @click="choosePlace(place)"><strong>{{ place.name }}</strong><small>{{ place.address }}</small></button></div>
    <div ref="canvas" class="location-map-canvas" aria-label="点击地图选择地点" />
    <small v-if="provider" class="location-note">搜索来源：{{ provider }}</small>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <p v-if="tileError" class="location-note">地图瓦片加载不完整，请检查网络；可切换到“粘贴坐标”。</p>
  </div>
</template>
