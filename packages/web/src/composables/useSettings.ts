import { ref } from 'vue';
import { apiGet, apiPatch } from '../api/client';

export function useSettings() {
  const settings = ref<Record<string, string>>({});
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      const res = await apiGet<{ settings: Record<string, string> }>('/settings');
      settings.value = res.settings;
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      loading.value = false;
    }
  }

  async function save(updates: Record<string, string>) {
    await apiPatch('/settings', updates);
    await load();
  }

  return { settings, loading, load, save };
}
