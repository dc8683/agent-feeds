<template>
  <div>
    <div class="page-header">设置</div>

    <div class="settings-section">
      <h3>拉取频率</h3>
      <div class="settings-row">
        <label>检查间隔</label>
        <select :value="settings.settings.value.fetch_interval_minutes || '30'" @change="update('fetch_interval_minutes', ($event.target as HTMLSelectElement).value)">
          <option value="15">15 分钟</option>
          <option value="30">30 分钟</option>
          <option value="60">1 小时</option>
          <option value="120">2 小时</option>
          <option value="240">4 小时</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h3>AI 配置</h3>
      <div class="settings-row">
        <label>LLM Provider</label>
        <select :value="settings.settings.value.llm_provider || 'deepseek'" @change="update('llm_provider', ($event.target as HTMLSelectElement).value)">
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <div class="settings-row">
        <label>API Key</label>
        <input type="password" :value="settings.settings.value.llm_api_key || ''" placeholder="sk-..." @change="update('llm_api_key', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="settings-row">
        <label>Model</label>
        <input type="text" :value="settings.settings.value.llm_model || 'deepseek-chat'" @change="update('llm_model', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="settings-row">
        <label>Whisper Provider</label>
        <select :value="settings.settings.value.whisper_provider || 'openai'" @change="update('whisper_provider', ($event.target as HTMLSelectElement).value)">
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </div>
      <div class="settings-row">
        <label>Whisper API Key</label>
        <input type="password" :value="settings.settings.value.whisper_api_key || ''" placeholder="sk-..." @change="update('whisper_api_key', ($event.target as HTMLInputElement).value)" />
      </div>
    </div>

    <div class="settings-section">
      <h3>数据</h3>
      <div class="settings-row">
        <label>媒体缓存</label>
        <select :value="settings.settings.value.media_cache_ttl_days || '7'" @change="update('media_cache_ttl_days', ($event.target as HTMLSelectElement).value)">
          <option value="1">1 天</option>
          <option value="3">3 天</option>
          <option value="7">7 天</option>
          <option value="14">14 天</option>
        </select>
      </div>
    </div>

    <div style="padding: 16px; text-align: center; color: var(--color-text-muted); font-size: 12px;">
      Agent Feeds v0.1.0
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSettings } from '../composables/useSettings';

const s = useSettings();

function update(key: string, value: string) {
  s.save({ [key]: value });
}

onMounted(() => {
  s.load();
});
</script>
