<script setup lang="ts">
import { pick } from 'lodash'
import type { Account } from '~/types/account'
import { connectRecentSignEvents } from '~/utils/recentSignEvents.client'

const accountStore = useAccountStore()

const showLoginModal = ref(false)
const search = ref('')
const filter = ref('all')
const visibleAccounts = computed(() => accountStore.accounts.filter((account) => {
  const matches = `${account.info?.realname || ''} ${account.info?.siteName || ''} ${account.uid}`.toLowerCase().includes(search.value.trim().toLowerCase())
  return matches && (filter.value === 'all' || (filter.value === 'selected' ? account.selected : account.loginExpired))
}))

async function handleSync() {
  if (accountStore.accountSyncLoading || accountStore.courseSyncLoading)
    return

  await accountStore.syncAccounts()
  void refreshRecentSignsQuietly(true)
}

async function handleSyncCourses() {
  await accountStore.syncCourses(accountStore.accounts.map(account => account.uid))
}

let lastRecentSignRefresh = 0
async function refreshRecentSignsQuietly(force = false) {
  if (!force && Date.now() - lastRecentSignRefresh < 1000)
    return
  lastRecentSignRefresh = Date.now()
  try {
    await accountStore.refreshRecentSigns()
  }
  catch {
    // A display-only refresh must not interrupt account actions.
  }
}

function refreshWhenVisible() {
  if (document.visibilityState === 'visible')
    void refreshRecentSignsQuietly()
}

async function selectAccount(account: Account) {
  if (account.loginExpired)
    return
  account.selected = !account.selected
}

let closeRecentSignEvents: (() => void) | undefined
tryOnMounted(() => {
  void accountStore.syncAccounts()
  void refreshRecentSignsQuietly()
  closeRecentSignEvents = connectRecentSignEvents(
    event => accountStore.applyRecentSign(event),
    refreshWhenVisible,
    event => accountStore.applyAccountSession(event),
  )
  document.addEventListener('visibilitychange', refreshWhenVisible)
  window.addEventListener('focus', refreshWhenVisible)
})
onBeforeUnmount(() => {
  closeRecentSignEvents?.()
  document.removeEventListener('visibilitychange', refreshWhenVisible)
  window.removeEventListener('focus', refreshWhenVisible)
})
</script>

<template>
  <section class="account-section">
    <div class="section-heading">
      <h2>我的账号 <span class="count">{{ accountStore.accounts.length }}</span></h2>
      <div class="account-sync-actions">
        <n-button secondary :loading="accountStore.accountSyncLoading" :disabled="accountStore.courseSyncLoading" @click="handleSync()">
          <template #icon>
            <Icon name="material-symbols:cloud-sync-outline-rounded" />
          </template>
          同步账户信息
        </n-button>
        <n-button secondary :loading="accountStore.courseSyncLoading" :disabled="accountStore.accountSyncLoading || !accountStore.accounts.length" @click="handleSyncCourses()">
          <template #icon>
            <Icon name="material-symbols:cloud-sync-outline-rounded" />
          </template>
          同步课程
        </n-button>
      </div>
    </div>

    <div class="account-filters">
      <n-input v-model:value="search" placeholder="搜索姓名、学校或账号" clearable aria-label="搜索账号"><template #prefix><Icon name="material-symbols:search-rounded" /></template></n-input>
      <n-select v-model:value="filter" aria-label="筛选账号" :options="[{ label: '全部账号', value: 'all' }, { label: '已选账号', value: 'selected' }, { label: '需要登录', value: 'expired' }]" />
    </div>

    <ClientOnly>
      <template v-if=" accountStore.accounts?.length! > 0">
        <div class="account-stack">
          <AccountItem v-for="account in visibleAccounts" v-bind="pick(account, ['uid', 'username', 'info', 'lastLoginTime', 'selected', 'setting', 'loginExpired'])" :key="account.uid" :recent-sign="accountStore.recentSigns[account.uid]" @click="selectAccount(account)" />
          <div v-if="!visibleAccounts.length" class="empty-card"><n-empty description="没有符合条件的账号" /><n-button @click="search = ''; filter = 'all'">清除筛选</n-button></div>
          <n-button class="add-account-button" block dashed @click="showLoginModal = true">
            <template #icon><Icon name="ic:outline-add-box" /></template>
            添加账号
          </n-button>
        </div>
      </template>
      <template v-else>
        <div class="empty-card">
          <n-empty description="暂无账号" size="small" />
          <n-button type="primary" block @click="showLoginModal = true">
            添加账号
          </n-button>
        </div>
      </template>
    </ClientOnly>
    <AccountLoginModal v-model:show="showLoginModal" @success="showLoginModal = false" />
  </section>
</template>

<style scoped>
.account-sync-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
