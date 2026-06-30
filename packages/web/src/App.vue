<template>
  <router-view />
  <nav class="bottom-nav">
    <router-link to="/" :class="{ active: route.path === '/' }">
      <span class="icon">🏠</span>
      Feed
    </router-link>
    <router-link to="/users" :class="{ active: route.path === '/users' }">
      <span class="icon">👤</span>
      博主
    </router-link>
    <router-link to="/settings" :class="{ active: route.path === '/settings' }">
      <span class="icon">⚙</span>
      设置
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
