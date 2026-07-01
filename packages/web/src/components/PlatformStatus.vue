<template>
  <div style="display: flex; gap: 12px; padding: 8px 16px; background: var(--color-surface); font-size: 12px; align-items: center;">
    <template v-if="statuses.length === 0">
      <span style="color: var(--color-text-muted);">检测中...</span>
    </template>
    <template v-else v-for="s in statuses" :key="s.platform">
      <span :class="['status-dot', statusColor(s.status)]"></span>
      <span style="color: var(--color-text-muted);">{{ platformLabel(s.platform) }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PlatformStatus } from '@agent-feeds/shared';

defineProps<{ statuses: PlatformStatus[] }>();

function platformLabel(p: string): string {
  const map: Record<string, string> = { xiaohongshu: '小红书', bilibili: 'B站', douyin: '抖音' };
  return map[p] || p;
}

function statusColor(s: string): string {
  if (s === 'connected') return 'green';
  if (s === 'rate_limited' || s === 'expired') return 'yellow';
  if (s === 'not_configured') return 'gray';
  return 'red';
}
</script>
