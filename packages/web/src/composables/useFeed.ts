import { ref } from 'vue';
import type { FeedItem } from '@agent-feeds/shared';
import { apiGet, apiPatch } from '../api/client';

interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useFeed() {
  const items = ref<FeedItem[]>([]);
  const loading = ref(false);
  const hasMore = ref(true);
  const cursor = ref<string | null>(null);
  const viewMode = ref<'single' | 'digest'>('single');
  const filterPlatform = ref('');
  const filterGroup = ref('');

  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    loading.value = true;

    try {
      const params = new URLSearchParams();
      if (filterPlatform.value) params.set('platform', filterPlatform.value);
      if (filterGroup.value) params.set('group', filterGroup.value);
      params.set('type', viewMode.value);
      if (cursor.value) params.set('cursor', cursor.value);
      params.set('limit', '20');

      const res = await apiGet<FeedResponse>(`/feed?${params}`);
      items.value.push(...res.items);
      cursor.value = res.nextCursor;
      hasMore.value = res.hasMore;
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    items.value = [];
    cursor.value = null;
    hasMore.value = true;
    await loadMore();
  }

  async function markRead(id: string) {
    await apiPatch(`/feed/${id}`, { is_read: true });
    const item = items.value.find(i => i.id === id);
    if (item) item.isRead = true;
  }

  async function toggleSave(id: string, saved: boolean) {
    await apiPatch(`/feed/${id}`, { is_saved: saved });
    const item = items.value.find(i => i.id === id);
    if (item) item.isSaved = saved;
  }

  return { items, loading, hasMore, viewMode, filterPlatform, filterGroup, loadMore, refresh, markRead, toggleSave };
}
