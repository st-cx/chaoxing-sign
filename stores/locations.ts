import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LOCATION_LIMIT, locationFingerprint, parseLocationImport, validateLocation, type SavedLocation } from '~/utils/locationLibrary'
import { refreshClientLocation, setRuntimeLocation } from '~/utils/clientLocation.client'

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<SavedLocation[]>([])
  const selectedId = ref('browser')
  const ready = ref(false)
  const error = ref('')
  let storageKey = ''
  const selected = computed(() => locations.value.find(item => item.id === selectedId.value))

  function activate(ownerId?: string) {
    const key = ownerId ? `chaoxing:locations:v1:${ownerId}` : ''
    if (key === storageKey && ready.value)
      return
    storageKey = key
    locations.value = []
    selectedId.value = 'browser'
    setRuntimeLocation(null)
    error.value = ''
    ready.value = !!key
    if (!key)
      return
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = parseLocationImport(raw)
        locations.value = parsed.map(item => ({ ...item, id: crypto.randomUUID() }))
        const savedSelection = JSON.parse(raw).selectedLocation
        const restored = locations.value.find(item => locationFingerprint(item) === savedSelection)
        if (restored) { selectedId.value = restored.id; setRuntimeLocation(restored) }
      }
    }
    catch { error.value = '无法读取本地坐标库；原数据未覆盖。请检查浏览器存储权限或导出备份。' }
  }

  function persist(next: SavedLocation[], selection = selectedId.value) {
    if (!ready.value || !storageKey)
      throw new Error('请先登录本站再保存坐标')
    if (error.value)
      throw new Error(error.value)
    const chosen = next.find(item => item.id === selection)
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, locations: next, selectedLocation: chosen ? locationFingerprint(chosen) : null })) }
    catch { throw new Error('保存失败：浏览器存储空间不足或禁止存储，请先导出备份') }
    locations.value = next
    selectedId.value = chosen?.id || 'browser'
    setRuntimeLocation(chosen || null)
  }

  function save(value: unknown, id?: string) {
    const validated = validateLocation(value)
    if (!id && locations.value.length >= LOCATION_LIMIT)
      throw new Error(`坐标库最多保存 ${LOCATION_LIMIT} 条`)
    const duplicate = locations.value.find(item => item.id !== id && locationFingerprint(item) === locationFingerprint(validated))
    if (duplicate)
      return duplicate.id
    if (id && !locations.value.some(item => item.id === id))
      throw new Error('该位置已不存在，请重新打开坐标库')
    const entry = { ...validated, id: id || crypto.randomUUID() }
    persist(id ? locations.value.map(item => item.id === id ? entry : item) : [...locations.value, entry])
    return entry.id
  }

  function select(id: string, refreshBrowser = true) {
    const entry = locations.value.find(item => item.id === id)
    if (id !== 'browser' && !entry)
      throw new Error('该位置已不存在，请重新选择')
    persist(locations.value, id)
    if (id === 'browser' && refreshBrowser)
      void refreshClientLocation()
  }

  function remove(id: string) {
    const wasSelected = selectedId.value === id
    persist(locations.value.filter(item => item.id !== id))
    if (wasSelected)
      select('browser')
  }

  function importFile(text: string) {
    const incoming = parseLocationImport(text)
    const seen = new Set(locations.value.map(locationFingerprint))
    const added: SavedLocation[] = []
    for (const item of incoming) {
      const key = locationFingerprint(item)
      if (!seen.has(key)) {
        seen.add(key)
        added.push({ ...item, id: crypto.randomUUID() })
      }
    }
    if (locations.value.length + added.length > LOCATION_LIMIT)
      throw new Error(`导入后将超过 ${LOCATION_LIMIT} 条，未修改原坐标库`)
    persist([...locations.value, ...added])
    return added.length
  }

  function exportFile() {
    return JSON.stringify({ version: 1, locations: locations.value.map(({ id, ...item }) => item) }, null, 2)
  }

  return { locations, selectedId, selected, ready, error, activate, save, select, remove, importFile, exportFile }
})
