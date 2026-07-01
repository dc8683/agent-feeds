<template>
  <div :class="['feed-card', { 'feed-card-unread': !item.isRead }]" :style="{ opacity: item.isRead ? 0.7 : 1 }" @click="expanded = !expanded">
    <!-- Avatar -->
    <div class="fc-avatar">
      <img v-if="(item as any).authorAvatar" :src="(item as any).authorAvatar" class="fc-avatar-img" @error="onAvatarError" />
      <span v-else class="fc-avatar-placeholder">{{ ((item as any).authorName || '?')[0] }}</span>
    </div>

    <div class="fc-body">
      <!-- Meta line -->
      <div class="fc-meta">
        <span class="fc-name">{{ (item as any).authorName || '未知' }}</span>
        <span class="fc-handle">@{{ platformHandle(item.sourcePlatform) }}</span>
        <span class="fc-dot">·</span>
        <span class="fc-time">{{ timeLabel(item.publishedAt, item.createdAt) }}</span>
      </div>

      <!-- Title -->
      <div class="fc-title" :class="{ 'line-clamp': !expanded }">{{ item.title || '(无标题)' }}</div>

      <!-- Body text -->
      <div class="fc-text" v-if="item.summary && item.summary !== item.title" :class="{ 'line-clamp': !expanded }">
        {{ item.summary }}
      </div>

      <!-- Expand hint -->
      <div class="fc-expand" v-if="hasLongContent">
        {{ expanded ? '收起' : '展开全文' }}
      </div>

      <!-- Cover image (full-width in content) -->
      <div class="fc-image" v-if="item.coverUrl" @click.stop="showLightbox = true">
        <img :src="item.coverUrl" :alt="item.title" loading="lazy" />
      </div>

      <!-- Actions -->
      <div class="fc-actions">
        <a v-if="item.sourceUrls[0]" :href="item.sourceUrls[0]" target="_blank" class="fc-action" @click.stop>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>

    <!-- Image Lightbox -->
    <Teleport to="body">
      <div v-if="showLightbox" class="lightbox-overlay" @click="closeLightbox" @wheel.prevent>
        <img
          ref="lightboxImgRef"
          :src="item.coverUrl"
          :alt="item.title"
          class="lightbox-img"
          :style="lightboxStyle"
          @click.stop
          @dblclick="toggleZoom"
          @wheel.prevent="onWheel"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />
        <div class="lightbox-hint" v-if="scale === 1">滚轮缩放 · 双击切换 · 拖拽平移</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '@agent-feeds/shared';
import { ref, computed } from 'vue';

const props = defineProps<{ item: FeedItem }>();

const expanded = ref(false);
const showLightbox = ref(false);
const lightboxImgRef = ref<HTMLImageElement | null>(null);
const avatarFailed = ref(false);

// Zoom/Pan state
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const lastTouches = ref<{ dist: number; cx: number; cy: number } | null>(null);

const lightboxStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  cursor: scale.value > 1 ? (isPanning.value ? 'grabbing' : 'grab') : 'zoom-in',
  transition: isPanning.value ? 'none' : 'transform 0.2s',
}));

function closeLightbox() {
  showLightbox.value = false;
  scale.value = 1;
  panX.value = 0;
  panY.value = 0;
}
function toggleZoom() {
  scale.value = scale.value > 1 ? 1 : 2.5;
  if (scale.value === 1) { panX.value = 0; panY.value = 0; }
}
function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.3 : 0.3;
  scale.value = Math.max(0.5, Math.min(5, scale.value + delta));
  if (scale.value <= 1) { panX.value = 0; panY.value = 0; }
}
function onMouseDown(e: MouseEvent) {
  if (scale.value <= 1) return;
  isPanning.value = true;
  panStart.value = { x: e.clientX - panX.value, y: e.clientY - panY.value };
}
function onMouseMove(e: MouseEvent) {
  if (!isPanning.value) return;
  panX.value = e.clientX - panStart.value.x;
  panY.value = e.clientY - panStart.value.y;
}
function onMouseUp() { isPanning.value = false; }
function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const t = e.touches;
    lastTouches.value = {
      dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
      cx: (t[0].clientX + t[1].clientX) / 2,
      cy: (t[0].clientY + t[1].clientY) / 2,
    };
  } else if (e.touches.length === 1 && scale.value > 1) {
    isPanning.value = true;
    panStart.value = { x: e.touches[0].clientX - panX.value, y: e.touches[0].clientY - panY.value };
  }
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault();
  if (e.touches.length === 2 && lastTouches.value) {
    const t = e.touches;
    const newDist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const newScale = scale.value * (newDist / lastTouches.value.dist);
    scale.value = Math.max(0.5, Math.min(5, newScale));
    lastTouches.value = { dist: newDist, cx: (t[0].clientX + t[1].clientX) / 2, cy: (t[0].clientY + t[1].clientY) / 2 };
    if (scale.value <= 1) { panX.value = 0; panY.value = 0; }
  } else if (isPanning.value && e.touches.length === 1) {
    panX.value = e.touches[0].clientX - panStart.value.x;
    panY.value = e.touches[0].clientY - panStart.value.y;
  }
}
function onTouchEnd() { isPanning.value = false; lastTouches.value = null; }

const hasLongContent = computed(() => {
  const text = props.item.summary || '';
  return text.length > 180 || (props.item.title || '').length > 60;
});

function onAvatarError() { avatarFailed.value = true; }

function platformHandle(p: string): string {
  const map: Record<string, string> = { xiaohongshu: '小红书', bilibili: 'bilibili', douyin: '抖音' };
  return map[p] || p;
}

function timeLabel(publishedAt: string, _createdAt: string): string {
  const pub = new Date(publishedAt).getTime();
  const diff = Date.now() - pub;
  if (diff < 0) return '刚刚';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
</script>

<style scoped>
.feed-card {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border, #eff3f4);
  cursor: pointer;
  transition: background 0.15s;
}
.feed-card:hover {
  background: rgba(0, 0, 0, 0.02);
}
.feed-card-unread {
  background: rgba(99, 102, 241, 0.03);
}

/* Avatar */
.fc-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
}
.fc-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.fc-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

/* Body */
.fc-body {
  flex: 1;
  min-width: 0;
}

/* Meta */
.fc-meta {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 13px;
  line-height: 1.3;
}
.fc-name {
  font-weight: 700;
  color: var(--color-text, #0f1419);
}
.fc-name:hover {
  text-decoration: underline;
}
.fc-handle,
.fc-dot,
.fc-time {
  color: var(--color-text-muted, #536471);
}
.fc-dot {
  margin: 0 1px;
}

/* Title */
.fc-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text, #0f1419);
  margin-top: 2px;
}
.fc-title.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Body text */
.fc-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text, #0f1419);
  margin-top: 4px;
  white-space: pre-line;
}
.fc-text.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fc-expand {
  font-size: 13px;
  color: var(--color-primary, #6366f1);
  margin-top: 4px;
}

/* Image */
.fc-image {
  margin-top: 10px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--color-border, #eff3f4);
  cursor: zoom-in;
}
.fc-image img {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  display: block;
}

/* Actions */
.fc-actions {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 10px;
}
.fc-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--color-text-muted, #536471);
  transition: all 0.15s;
}
.fc-action:hover {
  background: rgba(29, 155, 240, 0.1);
  color: #1d9bf0;
}

/* Lightbox */
:global(.lightbox-overlay) {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}
:global(.lightbox-img) {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  will-change: transform;
}
.lightbox-hint {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  pointer-events: none;
}
</style>
