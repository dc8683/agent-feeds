<template>
  <div class="platform-tabs">
    <button
      v-for="p in platforms"
      :key="p.key"
      :class="['platform-tab', { active: modelValue === p.key }]"
      @click="$emit('update:modelValue', p.key)"
    >
      <span :class="['status-dot', statusColor(statuses.find(s => s.platform === p.key)?.status || 'disconnected')]"></span>
      {{ p.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PlatformStatus } from '@agent-feeds/shared';

const platforms = [
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'bilibili', label: 'B站' },
  { key: 'douyin', label: '抖音' },
];

defineProps<{
  modelValue: string;
  statuses: PlatformStatus[];
}>();

defineEmits(['update:modelValue']);

function statusColor(s: string): string {
  if (s === 'connected') return 'green';
  if (s === 'rate_limited') return 'yellow';
  return 'red';
}
</script>
