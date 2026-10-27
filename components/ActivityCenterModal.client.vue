<script setup lang="ts">
import { manualSignKind, manualSignLabels, validateSignPhotoFile } from '~/utils/manualSign'
import { getClientLocationForQr, getFreshClientLocationForSign } from '~/utils/clientLocation.client'
import type { QrCoordinates } from '~/utils/qrLocation'

const props = defineProps<{ show: boolean; uid: string; name?: string; initialType?: string; courseId?: string; activityId?: string }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()
const accountStore = useAccountStore()
const items = ref<CX.ActivityItem[]>([])
const loading = ref(false)
const busy = ref(false)
const stage = ref('')
const filter = ref('all')
const query = ref('')
const selectedId = ref('')
const error = ref('')
const warnings = ref<string[]>([])
const result = ref('')
const photo = ref('')
const photoName = ref('')
const photoLoading = ref(false)
const signCode = ref('')
const photoInput = ref<HTMLInputElement>()
const cameraInput = ref<HTMLInputElement>()
const showQr = ref(false)
let generation = 0
let fileGeneration = 0
const selected = computed(() => items.value.find(a => String(a.id) === selectedId.value))
const kind = computed(() => selected.value ? manualSignKind(selected.value) : 'unknown')
const done = computed(() => ['签到成功', '已签到过'].includes(result.value))
const filtered = computed(() => items.value.filter(a => (!props.courseId || String(a.course.courseId) === String(props.courseId))
  && (filter.value === 'all' || manualSignKind(a) === filter.value)
  && `${a.course.name} ${a.name || a.nameOne}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const filters = [{ value: 'all', label: '全部' }, { value: 'photo', label: '拍照' }, { value: 'location', label: '位置' }, { value: 'code', label: '签到码' }, { value: 'gesture', label: '手势' }, { value: 'normal', label: '普通' }]

function clearDraft() { fileGeneration++; photoLoading.value = false; photo.value = ''; photoName.value = ''; signCode.value = ''; result.value = ''; error.value = '' }
function choose(activity: CX.ActivityItem) {
  if (busy.value || selectedId.value === String(activity.id)) return
  clearDraft()
  selectedId.value = String(activity.id)
}
async function refresh() {
  if (busy.value || loading.value) return
  const run = ++generation
  loading.value = true
  error.value = ''
  try {
    const response = await request(`/api/cx/accounts/${props.uid}/activities`, { params: { uid: props.uid } })
    if (run !== generation || !props.show) return
    if (response.code !== 200) throw new Error(response.message || '加载活动失败')
    const previous = selected.value
    items.value = response.data.activities
    warnings.value = response.data.warnings || []
    if (previous && (!selected.value || manualSignKind(previous) !== manualSignKind(selected.value))) {
      selectedId.value = ''; clearDraft()
    }
    const match = props.activityId && items.value.find(a => String(a.id) === String(props.activityId))
    if (match) { filter.value = 'all'; choose(match) }
    else if (!selected.value && filtered.value.length) choose(filtered.value[0])
  }
  catch (failure) { if (run === generation) error.value = (failure as any)?.data?.message || (failure as Error).message || '加载活动失败，请重试' }
  finally { if (run === generation) loading.value = false }
}
watch(() => props.show, (show) => {
  generation++; loading.value = false; items.value = []; selectedId.value = ''; warnings.value = []; query.value = ''; clearDraft()
  filter.value = props.initialType || 'all'
  if (show) void refresh()
}, { immediate: true })
watch([filter, query], () => {
  if (!filtered.value.some(a => String(a.id) === selectedId.value)) {
    selectedId.value = ''; clearDraft()
    if (filtered.value[0]) choose(filtered.value[0])
  }
})
onBeforeUnmount(() => { generation++; fileGeneration++ })

async function readPhoto(file?: File) {
  if (!file || busy.value) return
  const run = ++fileGeneration
  photo.value = ''; photoName.value = ''
  error.value = ''; photoLoading.value = true
  try {
    validateSignPhotoFile(file)
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('照片读取失败，请重新选择'))
      reader.readAsDataURL(file)
    })
    if (run !== fileGeneration) return
    photo.value = data; photoName.value = file.name; result.value = ''
  }
  catch (failure) { if (run === fileGeneration) error.value = (failure as Error).message }
  finally { if (run === fileGeneration) photoLoading.value = false }
}
function pick(event: Event) {
  const input = event.target as HTMLInputElement
  void readPhoto(input.files?.[0]); input.value = ''
}
function drop(event: DragEvent) { void readPhoto(event.dataTransfer?.files[0]) }

async function submit() {
  if (busy.value || photoLoading.value || !selected.value || done.value) return
  const activity = selected.value
  error.value = ''; result.value = ''
  if (kind.value === 'photo' && !photo.value) { error.value = '请先选择或拍摄照片'; return }
  if ((kind.value === 'code' || kind.value === 'gesture') && !/^\d{1,16}$/.test(signCode.value.trim())) { error.value = '请填写数字签到码或手势轨迹'; return }
  if (kind.value === 'qr') { showQr.value = true; return }
  busy.value = true
  try {
    let location: QrCoordinates | null | undefined
    if (kind.value === 'location') {
      stage.value = '正在获取位置…'; location = await getFreshClientLocationForSign()
      if (!location) throw new Error('定位不可用，请选择已保存的地点')
    }
    stage.value = kind.value === 'photo' ? '正在上传照片并提交…' : '正在提交…'
    const response = await request(`/api/cx/accounts/${props.uid}/manual_sign`, { method: 'POST', body: {
      uid: props.uid, activityId: String(activity.id), courseId: String(activity.course.courseId),
      ...(kind.value === 'photo' ? { photo: photo.value } : {}),
      ...(location ? { location } : {}),
      ...(['code', 'gesture'].includes(kind.value) ? { signCode: signCode.value.trim() } : {}),
    } })
    if (response.code !== 200) throw new Error(response.message || '提交失败')
    result.value = response.data.result || '未收到明确结果，请在官方记录中核对'
  }
  catch (failure) { error.value = (failure as any)?.data?.message || (failure as Error).message || '提交失败，输入已保留' }
  finally { busy.value = false; stage.value = '' }
}
async function submitQr(link: string) {
  if (busy.value || !selected.value) return
  busy.value = true
  try {
    const location = await getClientLocationForQr()
    await accountStore.signByQrCode(props.uid, link, String(selected.value.course.courseId), undefined, location)
    result.value = '扫码任务已交给队列，请在首页查看最终结果'
    showQr.value = false
  }
  catch (failure) { error.value = (failure as any)?.data?.message || (failure as Error).message }
  finally { busy.value = false }
}
</script>

<template>
  <n-modal :show="show" preset="card" :title="`${name || '当前账号'} · 签到中心`" class="mobile-sheet activity-center" :closable="!busy" :close-on-esc="!busy" :mask-closable="false" @update:show="emit('update:show', $event)">
    <div class="section-heading"><p class="location-note">选择正在进行的活动，准备好照片或位置后再提交。</p><n-button secondary :loading="loading" :disabled="busy" @click="refresh">刷新活动</n-button></div>
    <div class="sign-filter-tabs" role="group" aria-label="签到类型"><button v-for="tab in filters" :key="tab.value" type="button" :disabled="busy" :class="{ active: filter === tab.value }" @click="filter = tab.value">{{ tab.label }}</button></div>
    <n-input v-model:value="query" placeholder="搜索课程或活动" :disabled="busy" clearable />
    <n-alert v-if="warnings.length" type="warning" class="my-3">{{ warnings.join('；') }}</n-alert>
    <n-spin :show="loading"><div class="activity-center-grid">
      <div class="activity-choices">
        <button v-for="activity in filtered" :key="activity.id" type="button" class="activity-choice" :class="{ selected: selectedId === String(activity.id) }" :disabled="busy" @click="choose(activity)">
          <span class="location-badge">{{ manualSignLabels[manualSignKind(activity)] }}</span><strong>{{ activity.course.name }}</strong><span>{{ activity.name || activity.nameOne }}</span><small>{{ selectedId === String(activity.id) ? '✓ 正在准备' : '点击选择' }}</small>
        </button>
        <n-empty v-if="!loading && !filtered.length" :description="warnings.length ? '部分活动未能加载，请刷新重试' : '当前分类没有正在进行的签到'" />
      </div>
      <section v-if="selected" class="sign-preparation">
        <span class="location-badge">{{ manualSignLabels[kind] }}</span><h3>{{ selected.name || selected.nameOne }}</h3><p class="location-note">{{ selected.course.name }} · {{ name || '当前账号' }}</p>
        <template v-if="kind === 'photo'">
          <div class="photo-drop" @dragover.prevent @drop.prevent="drop">
            <img v-if="photo" :src="photo" alt="待提交照片预览" class="sign-photo-preview">
            <div v-else><strong>先选择签到照片</strong><p>支持拖入图片，或用手机拍摄</p><small>JPG / PNG / WebP · 最大 5 MB</small></div>
            <p v-if="photoName" class="photo-filename">{{ photoName }}</p>
          </div>
          <div class="photo-pick-actions"><n-button :disabled="busy" :loading="photoLoading" @click="photoInput?.click()">{{ photo ? '更换照片' : '选择照片' }}</n-button><n-button :disabled="busy || photoLoading" @click="cameraInput?.click()">拍摄照片</n-button></div>
          <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择签到照片" hidden @change="pick">
          <input ref="cameraInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="拍摄签到照片" hidden @change="pick">
          <p class="location-note">照片将在点击下方提交按钮后上传到此学习通账号。关闭窗口会清除本次照片。</p>
        </template>
        <LocationPicker v-if="kind === 'location'" compact :disabled="busy" />
        <template v-if="kind === 'gesture' || kind === 'code'">
          <label :for="`sign-code-${uid}`">{{ kind === 'gesture' ? '按老师展示的顺序填写数字轨迹' : '老师提供的签到码' }}</label>
          <n-input :id="`sign-code-${uid}`" v-model:value="signCode" :disabled="busy" :placeholder="kind === 'gesture' ? '例如：12589' : '请输入签到码'" :maxlength="16" />
          <div v-if="kind === 'gesture'" class="gesture-guide" aria-label="手势九宫格编号"><span v-for="n in 9" :key="n">{{ n }}</span></div>
        </template>
        <p v-if="kind === 'normal'" class="location-note">普通签到无需额外材料，确认活动后点击提交。</p>
        <n-alert v-if="result" :type="done ? 'success' : 'warning'" class="my-3">{{ result }}</n-alert>
        <n-button block type="primary" class="sign-submit" :loading="busy" :disabled="photoLoading || done || kind === 'unknown'" @click="submit">{{ done ? '已完成' : busy ? stage : kind === 'photo' ? '上传照片并签到' : kind === 'qr' ? '打开扫码窗口' : '确认签到' }}</n-button>
      </section>
      <div v-else-if="!loading" class="sign-preparation empty-card">先在左侧选择一个活动</div>
    </div></n-spin>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <QrCodeSignModal v-model:show="showQr" :loading="busy" @success="submitQr" />
  </n-modal>
</template>
