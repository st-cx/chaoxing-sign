<script setup lang="ts">
const router = useRouter()
const route = useRoute()

const accountStore = useAccountStore()
const loading = ref(false)
const loadError = ref('')

const account = computed(() => accountStore.accounts.find(account => account.uid === route.params.uid))

onMounted(async () => {
  if (account.value)
    return
  loading.value = true
  try { await accountStore.syncAccounts() }
  catch { loadError.value = '加载账号失败，请返回首页重试' }
  finally { loading.value = false }
})

function handleBack() {
  router.push('/')
}
</script>

<template>
  <n-card class="account-detail-card">
    <n-page-header @back="handleBack">
      <template #avatar>
        <n-avatar
          :src="account?.info.avatar"
        />
      </template>
      <template #title>
        {{ account?.info.siteName }} {{ account?.info.realname }}
      </template>
    </n-page-header>
    <n-spin :show="loading">
      <template v-if="account">
        <ClientOnly><LocationPicker compact /></ClientOnly>
        <CourseList :account="account" :courses="account.courses || []" />
      </template>
      <n-empty v-else :description="loading ? '正在加载账号' : loadError || '账号不存在或已移除'" />
    </n-spin>
  </n-card>
</template>
