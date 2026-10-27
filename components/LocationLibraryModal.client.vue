<script setup lang="ts">
import { useLocationsStore } from '~/stores/locations'
import { refreshClientLocation } from '~/utils/clientLocation.client'
import { parseCoordinatePair, type SavedLocation } from '~/utils/locationLibrary'
import { isQrCoordinates, type QrCoordinates } from '~/utils/qrLocation'

const props = defineProps<{ show: boolean; seed?: Partial<SavedLocation>; startAdding?: boolean }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()
const library = useLocationsStore()
const ms = useMessage()
const query = ref('')
const editingId = ref<string>()
const locating = ref(false)
const importing = ref(false)
const fileInput = ref<HTMLInputElement>()
const formError = ref('')
const coordinatePair = ref('')
const editor = ref<HTMLElement>()
const editorOpen = ref(false)
const inputMode = ref('map')
const mapValue = computed(() => {
  const location = { longitude: Number(draft.value.longitude), latitude: Number(draft.value.latitude), coordinateSystem: draft.value.coordinateSystem }
  return draft.value.longitude !== '' && draft.value.latitude !== '' && isQrCoordinates(location) ? location : undefined
})
const blank = () => ({ name: '', address: '', longitude: '', latitude: '', coordinateSystem: 'bd09' as 'bd09' | 'wgs84' })
const draft = ref(blank())
const filtered = computed(() => library.locations.filter(item => `${item.name} ${item.address}`.toLowerCase().includes(query.value.toLowerCase().trim())))
let generation = 0

function reset() {
  generation++
  locating.value = false
  editingId.value = undefined
  draft.value = blank()
  formError.value = ''
  coordinatePair.value = ''
  editorOpen.value = false
  inputMode.value = 'map'
}

watch(() => props.show, (show) => {
  reset()
  if (show && props.seed) {
    draft.value = { ...blank(), ...props.seed, longitude: String(props.seed.longitude ?? ''), latitude: String(props.seed.latitude ?? '') }
    editorOpen.value = true
  }
  else if (show && (props.startAdding || !library.locations.length)) {
    editorOpen.value = true
  }
}, { immediate: true })

function edit(item: SavedLocation) {
  reset()
  editingId.value = item.id
  editorOpen.value = true
  draft.value = { ...item, longitude: String(item.longitude), latitude: String(item.latitude) }
  nextTick(() => editor.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

function fillCoordinates() {
  try { Object.assign(draft.value, parseCoordinatePair(coordinatePair.value)); formError.value = '' }
  catch (error) { formError.value = (error as Error).message }
}
function setInputMode(mode: 'map' | 'paste') {
  if (inputMode.value === mode) return
  inputMode.value = mode
  coordinatePair.value = ''
  formError.value = ''
}
watch(coordinatePair, (text) => {
  if (inputMode.value !== 'paste') return
  try { Object.assign(draft.value, parseCoordinatePair(text)); formError.value = '' }
  catch { draft.value.longitude = ''; draft.value.latitude = '' }
})
function pickMap(value: QrCoordinates & { name?: string; address?: string }) {
  draft.value = { ...draft.value, longitude: String(value.longitude), latitude: String(value.latitude), coordinateSystem: value.coordinateSystem || 'wgs84',
    name: draft.value.name || value.name || '', address: value.address || draft.value.address }
  formError.value = ''
}

function save(useNow = false) {
  try {
    if (inputMode.value === 'paste' && coordinatePair.value.trim())
      Object.assign(draft.value, parseCoordinatePair(coordinatePair.value))
    const id = library.save(draft.value, editingId.value)
    if (useNow)
      library.select(id)
    ms.success(useNow ? '已保存，本次运行将使用此位置' : '已保存到坐标库')
    reset()
    if (useNow) emit('update:show', false)
  }
  catch (error) { formError.value = (error as Error).message }
}

async function locate() {
  if (locating.value)
    return
  const current = ++generation
  locating.value = true
  formError.value = ''
  const location = await refreshClientLocation()
  if (current !== generation)
    return
  locating.value = false
  if (!location) {
    formError.value = '未能获取当前位置，请检查定位权限，或手动填写坐标'
    return
  }
  draft.value = { ...draft.value, longitude: String(location.longitude), latitude: String(location.latitude), coordinateSystem: 'wgs84' }
}

function choose(item: SavedLocation) {
  try {
    library.select(item.id)
    ms.success(`本次位置：${item.name}`)
    emit('update:show', false)
  }
  catch (error) { ms.error((error as Error).message) }
}

function remove(id: string) {
  try {
    library.remove(id)
    if (editingId.value === id)
      reset()
    ms.success('位置已删除')
  }
  catch (error) { ms.error((error as Error).message) }
}

function download() {
  const blob = new Blob([library.exportFile()], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '某星坐标库.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  importing.value = true
  try {
    if (file.size > 512_000)
      throw new Error('请选择 500 KB 以内的文件')
    const count = library.importFile(await file.text())
    ms.success(`新增 ${count} 个位置，重复项已跳过`)
  }
  catch (error) { ms.error((error as Error).message) }
  finally { importing.value = false; input.value = '' }
}
</script>

<template>
  <n-modal :show="show" preset="card" :title="editorOpen ? (editingId ? '编辑地点' : '添加常用地点') : '我的常用地点'" class="mobile-sheet location-sheet" :mask-closable="false" @update:show="emit('update:show', $event)">
    <p class="location-note">保存后在首页直接点选，自动记住上次选择。仅保存在当前浏览器，可导出备份。</p>
    <n-alert v-if="library.error" type="error" class="mb-3">{{ library.error }}</n-alert>
    <n-button v-if="!editorOpen" type="primary" block @click="reset(); editorOpen = true">＋ 添加位置</n-button>
    <div v-if="editorOpen" ref="editor" class="location-editor">
      <div class="sign-filter-tabs"><button type="button" :class="{ active: inputMode === 'map' }" @click="setInputMode('map')">地图选点</button><button type="button" :class="{ active: inputMode === 'paste' }" @click="setInputMode('paste')">粘贴坐标</button><n-button text :loading="locating" @click="locate">◎ 获取当前位置</n-button></div>
      <LocationMap v-if="inputMode === 'map'" :value="mapValue" @select="pickMap" />
      <n-form label-placement="top" :show-feedback="false" @submit.prevent="save()">
        <n-form-item v-if="inputMode === 'paste'" label="粘贴坐标（自动识别）"><n-input v-model:value="coordinatePair" placeholder="经度,纬度，例如 113.093,22.600" @keydown.enter.prevent="fillCoordinates" /></n-form-item>
        <n-form-item v-if="inputMode === 'paste'" label="粘贴坐标的来源"><n-select v-model:value="draft.coordinateSystem" :options="[{ label: '百度地图拾取（BD-09）', value: 'bd09' }, { label: '浏览器 / GPS（WGS-84）', value: 'wgs84' }]" /></n-form-item>
        <p v-if="mapValue" class="location-note">✓ 已选坐标：{{ draft.longitude }}, {{ draft.latitude }}</p>
        <n-form-item label="位置名称"><n-input v-model:value="draft.name" placeholder="例如：图书馆 · 二楼" :maxlength="60" /></n-form-item>
        <n-form-item label="地址 / 备注"><n-input v-model:value="draft.address" placeholder="选填，方便区分教学楼与校区" :maxlength="200" /></n-form-item>
        <details class="coordinate-advanced"><summary>高级：手动调整经纬度与来源（当前{{ draft.coordinateSystem === 'bd09' ? '百度' : 'GPS' }}）</summary>
        <div class="coordinate-fields">
          <n-form-item label="经度"><n-input v-model:value="draft.longitude" placeholder="例如 113.093000" /></n-form-item>
          <n-form-item label="纬度"><n-input v-model:value="draft.latitude" placeholder="例如 22.600000" /></n-form-item>
        </div>
        <n-form-item label="坐标来源">
          <n-select v-model:value="draft.coordinateSystem" :options="[{ label: '百度地图拾取（BD-09）', value: 'bd09' }, { label: '浏览器 / GPS（WGS-84）', value: 'wgs84' }]" />
        </n-form-item>
        </details>
        <a v-if="inputMode === 'paste'" class="map-link" href="https://api.map.baidu.com/lbsapi/getpoint/index.html" target="_blank" rel="noopener noreferrer">打开百度地图拾取坐标 ↗</a>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="location-editor-actions">
          <n-button @click="reset">取消</n-button>
          <n-button :disabled="locating || !library.ready" @click="save()">保存到坐标库</n-button>
          <n-button type="primary" :disabled="locating || !library.ready" @click="save(true)">保存并使用</n-button>
        </div>
      </n-form>
    </div>
    <template v-if="!editorOpen"><div class="section-heading location-list-heading">
      <h3>已保存 <span class="count">{{ library.locations.length }}</span></h3>
      <div class="location-tools"><n-button text :loading="importing" @click="fileInput?.click()">导入</n-button><n-button text :disabled="!library.locations.length" @click="download">导出</n-button></div>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="upload">
    </div>
    <n-input v-model:value="query" placeholder="搜索位置名称或地址" clearable aria-label="搜索坐标库" />
    <div class="saved-location-list">
      <article v-for="item in filtered" :key="item.id" class="saved-location" :class="{ 'is-selected': library.selectedId === item.id }">
        <div class="saved-location-info"><h4>{{ item.name }} <span v-if="library.selectedId === item.id" class="location-badge">本次使用</span></h4><p>{{ item.address || '未填写地址' }}</p><small>{{ item.longitude }}, {{ item.latitude }} · {{ item.coordinateSystem === 'bd09' ? '百度' : 'GPS' }}</small></div>
        <div class="saved-location-actions">
          <n-button size="small" secondary type="primary" @click="choose(item)">选用</n-button>
          <n-button size="small" quaternary :aria-label="`编辑 ${item.name}`" @click="edit(item)">编辑</n-button>
          <n-popconfirm @positive-click="remove(item.id)"><template #trigger><n-button size="small" quaternary type="error" :aria-label="`删除 ${item.name}`">删除</n-button></template>删除“{{ item.name }}”？{{ library.selectedId === item.id ? '本次位置将恢复为浏览器定位。' : '' }}</n-popconfirm>
        </div>
      </article>
      <n-empty v-if="!filtered.length" :description="query ? '没有匹配的位置' : '还没有保存位置，在上方添加第一个吧'" />
    </div>
    </template>
  </n-modal>
</template>
