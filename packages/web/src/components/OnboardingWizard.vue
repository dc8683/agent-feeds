<template>
  <div v-if="visible" style="position: fixed; inset: 0; background: var(--color-bg); z-index: 200; max-width: var(--max-width); margin: 0 auto; overflow-y: auto;">
    <!-- Step 1 -->
    <div v-if="step === 1" style="padding: 40px 24px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 16px;">🚀</div>
      <h2 style="margin-bottom: 12px;">欢迎使用 Agent Feeds</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 32px; font-size: 14px; line-height: 1.6;">
        聚合小红书/B站/抖音关注内容<br />AI 总结后推送到统一信息流
      </p>
      <div style="text-align: left; background: var(--color-surface); border-radius: var(--radius); padding: 16px; margin-bottom: 24px; font-size: 13px; line-height: 1.8;">
        <p>1. 打开 Chrome 扩展页面 <code>chrome://extensions</code></p>
        <p>2. 开启"开发者模式"</p>
        <p>3. 加载插件目录: <code>packages/extension</code></p>
        <p>4. 打开小红书页面完成连接</p>
      </div>
      <button class="btn btn-primary" @click="step = 2" style="width: 100%;">下一步</button>
      <button class="btn btn-ghost" @click="$emit('close')" style="width: 100%; margin-top: 8px;">跳过，稍后设置</button>
    </div>

    <!-- Step 2 -->
    <div v-if="step === 2" style="padding: 40px 24px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 16px;">🔗</div>
      <h2 style="margin-bottom: 12px;">连接平台账号</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">
        请在浏览器中打开以下平台页面完成连接
      </p>
      <div v-for="p in platforms" :key="p.key" style="background: var(--color-surface); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span>{{ p.label }}</span>
        <span style="color: var(--color-text-muted);">等待连接</span>
      </div>
      <button class="btn btn-primary" @click="step = 3" style="width: 100%; margin-top: 24px;">下一步</button>
    </div>

    <!-- Step 3 -->
    <div v-if="step === 3" style="padding: 40px 24px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 16px;">✅</div>
      <h2 style="margin-bottom: 12px;">选择订阅博主</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">
        从平台关注列表中选择要订阅的博主
      </p>
      <p style="color: var(--color-text-muted); font-size: 13px;">
        连接平台后可拉取关注列表
      </p>
      <button class="btn btn-primary" @click="step = 4" style="width: 100%; margin-top: 24px;">下一步</button>
    </div>

    <!-- Step 4 -->
    <div v-if="step === 4" style="padding: 40px 24px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 16px;">✨</div>
      <h2 style="margin-bottom: 12px;">设置完成!</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 32px; font-size: 14px;">
        首次拉取将在后台进行<br />内容处理后出现在 Feed 中
      </p>
      <button class="btn btn-primary" @click="$emit('close')" style="width: 100%;">前往 Feed</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineEmits(['close']);

const visible = ref(true);
const step = ref(1);

const platforms = [
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'bilibili', label: 'B站' },
  { key: 'douyin', label: '抖音' },
];
</script>
