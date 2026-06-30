<template>
  <div :class="['card', { 'feed-card-unread': !item.isRead }]" :style="{ opacity: item.isRead ? 0.7 : 1 }">
    <div class="card-header">
      <span class="author">@{{ (item as any).authorName || '未知' }}</span>
      <span class="meta">· {{ platformLabel(item.sourcePlatform) }} · {{ timeLabel(item.publishedAt, item.createdAt) }}</span>
    </div>
    <div class="card-body">
      {{ displayText() }}
    </div>
    <div class="card-footer">
      <a v-if="item.sourceUrls[0]" :href="item.sourceUrls[0]" target="_blank" style="color: var(--color-text-muted); text-decoration: none; font-size: 12px;">📎 原文</a>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" @click="$emit('toggle-save', item.id, !item.isSaved)">
        {{ item.isSaved ? '⭐' : '☆' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '@agent-feeds/shared';

const props = defineProps<{ item: FeedItem }>();
defineEmits(['toggle-save']);

function displayText(): string {
  const text = props.item.summary || props.item.title || '';
  return text || '(暂无内容)';
}

function platformLabel(p: string): string {
  const map: Record<string, string> = { xiaohongshu: '小红书', bilibili: 'B站', douyin: '抖音' };
  return map[p] || p;
}

function timeLabel(publishedAt: string, createdAt: string): string {
  // 小红书 DOM 抓取拿不到真实发布时间，publishedAt ≈ createdAt ≈ fetchTime
  // 如果两者相同，说明没有真实时间，显示"刚刚"
  const pub = new Date(publishedAt).getTime();
  const cre = new Date(createdAt).getTime();
  if (Math.abs(pub - cre) < 1000) {
    return '刚刚';
  }
  const diff = Date.now() - pub;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
</script>
