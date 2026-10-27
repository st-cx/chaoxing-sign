<script setup lang="ts">
const accounts = useAccountStore()
const available = computed(() => accounts.accounts.filter(item => !item.loginExpired).length)
</script>

<template>
  <section class="workspace-hero">
    <div class="workspace-hero-copy"><span class="eyebrow">某星 · WORKSPACE</span><h1>签到，从容一点。</h1><p>账号、常用位置与签到结果，在这里有序管理。</p><div class="hero-tags"><span>多账号管理</span><span>常用坐标库</span><span>实时结果</span></div></div>
    <div class="workspace-summary"><div><strong>{{ accounts.accounts.length.toString().padStart(2, '0') }}</strong><span>管理账号</span></div><div><strong>{{ available.toString().padStart(2, '0') }}</strong><span>可用账号</span></div><div><strong>{{ accounts.selectAccounts.length.toString().padStart(2, '0') }}</strong><span>当前已选</span></div></div>
  </section>
</template>
