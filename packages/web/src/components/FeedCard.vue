<template>
  <div :class="['card', { 'feed-card-unread': !item.isRead }]" :style="{ opacity: item.isRead ? 0.7 : 1 }">
    <div class="card-header">
      <span class="author">@{{ authorName }}</span>
      <span class="meta">· {{ platformLabel(item.sourcePlatform) }} · {{ timeAgo(item.publishedAt) }}</span>
      <span v-if="item.type === 'user_digest'" style="font-size: 11px; color: var(--color-primary);">
        · {{ item.rawPostIds.length }}条新内容
      </span>
    </div>
    <div class="card-body">
      {{ item.summary || '(无内容)' }}
    </div>
    <div class="card-footer">
      <div class="tags">
        <span v-for="tag in item.aiTags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <span style="flex:1"></span>
      <a v-if="item.sourceUrls[0]" :href="item.sourceUrls[0]" target="_blank" style="color: var(--color-text-muted); text-decoration: none;">📎 原文</a>
      <button class="btn btn-ghost btn-sm" @click="$emit('toggle-save', item.id, !item.isSaved)">
        {{ item.isSaved ? '⭐' : '☆' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '@agent-feeds/shared';

const props = defineProps<{ item: FeedItem; authorName?: string }>();
defineEmits(['mark-read', 'toggle-save']);

function platformLabel(p: string): string {
  const map: Record<string, string> = { xiaohongshu: '小红书', bilibili: 'B站', douyin: '抖音' };
  return map[p] || p;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
</script>
