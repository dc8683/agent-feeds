<template>
  <div>
    <FeedCard
      v-for="item in items"
      :key="item.id"
      :item="item"
      @toggle-save="(id, saved) => $emit('toggle-save', id, saved)"
    />

    <div v-if="items.length === 0 && !loading" style="text-align: center; padding: 60px 16px; color: var(--color-text-muted);">
      <p style="font-size: 40px; margin-bottom: 12px;">📭</p>
      <p>暂无内容</p>
      <p style="font-size: 12px; margin-top: 4px;">连接平台并订阅博主后，内容将出现在这里</p>
    </div>

    <div v-if="loading" style="text-align: center; padding: 16px; color: var(--color-text-muted);">
      加载中...
    </div>

    <div v-if="hasMore && !loading" style="text-align: center; padding: 16px;">
      <button class="btn btn-ghost" @click="$emit('load-more')">加载更多</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '@agent-feeds/shared';
import FeedCard from './FeedCard.vue';

defineProps<{
  items: FeedItem[];
  loading: boolean;
  hasMore: boolean;
}>();

defineEmits(['load-more', 'mark-read', 'toggle-save']);
</script>
