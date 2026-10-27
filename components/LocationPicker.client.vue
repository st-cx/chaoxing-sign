<script setup lang="ts">
import { useLocationsStore } from '~/stores/locations'
import { clientLocationStatus, refreshClientLocation } from '~/utils/clientLocation.client'

defineProps<{ disabled?: boolean; compact?: boolean }>()
const library = useLocationsStore()
const showLibrary = ref(false)
const startAdding = ref(false)
const query = ref('')
const expanded = ref(false)
const refreshing = ref(false)
const failure = ref('')
const matches = computed(() => library.locations.filter(item => `${item.name} ${item.address}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const visible = computed(() => expanded.value || query.value ? matches.value : matches.value.slice(0, 4))
function select(id: string) {
  try { library.select(id); failure.value = '' }
  catch (error) { failure.value = (error as Error).message }
}
function open(add = false) { startAdding.value = add; showLibrary.value = true }
async function refresh() {
  if (refreshing.value) return
  refreshing.value = true; failure.value = ''
  try {
    const location = await refreshClientLocation()
    if (!location) throw new Error('定位未成功，请检查权限，或添加常用地点')
    library.select('browser', false)
  }
  catch (error) { failure.value = (error as Error).message }
  finally { refreshing.value = false }
}
</script>

<template>
  <section class="location-picker" :class="{ 'location-picker-compact': compact }" aria-label="签到地点">
    <div class="section-heading"><h3>签到地点</h3><n-button text :disabled="disabled" @click="open()">管理</n-button></div>
    <div class="current-place" role="status"><span class="current-place-check">✓</span><div><strong>{{ library.selected?.name || '使用当前位置' }}</strong><p>{{ library.selected?.address || (library.selected ? '已保存并记住，下次自动选用' : '提交时获取设备位置') }}</p></div></div>
    <n-input v-if="library.locations.length > 4" v-model:value="query" placeholder="查找常用地点" :disabled="disabled" clearable />
    <div class="place-quick-list" role="group" aria-label="常用地点">
      <button v-for="item in visible" :key="item.id" type="button" class="place-quick-button" :class="{ selected: library.selectedId === item.id }" :aria-pressed="library.selectedId === item.id" :disabled="disabled" @click="select(item.id)"><strong>{{ item.name }}</strong><span>{{ item.address || '已保存的位置' }}</span><i v-if="library.selectedId === item.id">✓</i></button>
      <button class="place-add-button" type="button" :disabled="disabled" @click="open(true)">＋ 添加地点</button>
    </div>
    <n-button v-if="matches.length > 4 && !query" text :disabled="disabled" @click="expanded = !expanded">{{ expanded ? '收起' : `查看全部 ${matches.length} 个地点` }}</n-button>
    <div class="place-bottom-actions"><n-button text :disabled="disabled || refreshing" :loading="refreshing" @click="refresh">◎ 使用当前位置</n-button><small v-if="library.selected">已记住此地点</small><small v-else-if="clientLocationStatus === 'ready'">定位已就绪</small></div>
    <p v-if="failure || library.error" role="alert" class="form-error">{{ failure || library.error }}</p>
    <LocationLibraryModal v-model:show="showLibrary" :start-adding="startAdding" />
  </section>
</template>
