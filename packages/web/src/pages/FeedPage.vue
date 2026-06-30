<template>
  <div>
    <PlatformStatus :statuses="platformStatuses" />
    <FilterBar
      v-model:platform="feed.filterPlatform.value"
      v-model:group="feed.filterGroup.value"
      v-model:mode="feed.viewMode.value"
      @refresh="feed.refresh"
    />
    <FeedList
      :items="feed.items.value"
      :loading="feed.loading.value"
      :has-more="feed.hasMore.value"
      @load-more="feed.loadMore"
      @mark-read="feed.markRead"
      @toggle-save="feed.toggleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useFeed } from '../composables/useFeed';
import PlatformStatus from '../components/PlatformStatus.vue';
import FilterBar from '../components/FilterBar.vue';
import FeedList from '../components/FeedList.vue';
import type { PlatformStatus as PS } from '@agent-feeds/shared';

const feed = useFeed();

const platformStatuses = ref<PS[]>([
  { platform: 'xiaohongshu', status: 'disconnected', message: '等待连接' },
  { platform: 'bilibili', status: 'disconnected', message: '等待连接' },
  { platform: 'douyin', status: 'disconnected', message: '等待连接' },
]);

onMounted(() => {
  feed.refresh();
});
</script>
