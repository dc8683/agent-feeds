<template>
  <div class="filter-bar">
    <select :value="platform" @change="$emit('update:platform', ($event.target as HTMLSelectElement).value)">
      <option value="">全部平台</option>
      <option value="xiaohongshu">小红书</option>
      <option value="bilibili">B站</option>
      <option value="douyin">抖音</option>
    </select>
    <select :value="group" @change="$emit('update:group', ($event.target as HTMLSelectElement).value)">
      <option value="">全部分组</option>
    </select>
    <select :value="mode" @change="$emit('update:mode', ($event.target as HTMLSelectElement).value)">
      <option value="single">单条</option>
      <option value="user_digest">归并</option>
    </select>
    <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">🔄</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  platform: string;
  group: string;
  mode: string;
}>();

defineEmits(['update:platform', 'update:group', 'update:mode', 'refresh']);
</script>
