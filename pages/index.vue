<template>
  <div class="home-page">
    <div class="home-content">
      <Hero />
      <div class="dashboard-grid">
        <AccountList />
        <aside class="workspace-aside">
          <ClientOnly><LocationPicker /></ClientOnly>
          <section class="workflow-card">
            <span class="eyebrow">QUICK START</span><h3>三个步骤，准备就绪</h3>
            <ol><li><span>01</span><div><strong>选择账号</strong><p>勾选账号进行批量操作，单个账号可直接扫码。</p></div></li><li><span>02</span><div><strong>确认位置</strong><p>选择坐标库中的位置，或使用浏览器定位。</p></div></li><li><span>03</span><div><strong>扫码并查看结果</strong><p>摄像头、图片、链接均可；每个账号单独反馈。</p></div></li></ol>
            <NuxtLink to="/help" class="map-link">查看完整使用指南 →</NuxtLink>
          </section>
        </aside>
      </div>
      <Operation />
    </div>
  </div>
</template>
