<template>
  <div :class="['card', 'feed-card', { 'feed-card-unread': !item.isRead, 'feed-card-expanded': expanded }]" :style="{ opacity: item.isRead ? 0.7 : 1 }">
    <div class="feed-card-inner" @click="expanded = !expanded">
      <!-- Cover thumbnail -->
      <div class="feed-card-cover" v-if="item.coverUrl" @click.stop="showLightbox = true">
        <img :src="item.coverUrl" :alt="item.title" loading="lazy" @error="onImageError" />
      </div>
      <div class="feed-card-content">
        <!-- Title -->
        <div class="feed-card-title" :class="{ 'line-clamp': !expanded }">{{ item.title || '(无标题)' }}</div>
        <!-- Meta: author, platform, time -->
        <div class="feed-card-meta">
          <span class="feed-card-author">@{{ (item as any).authorName || '未知' }}</span>
          <span class="feed-card-sep">·</span>
          <span>{{ platformLabel(item.sourcePlatform) }}</span>
          <span class="feed-card-sep">·</span>
          <span>{{ timeLabel(item.publishedAt, item.createdAt) }}</span>
        </div>
        <!-- Summary body text -->
        <div class="feed-card-summary" v-if="item.summary && item.summary !== item.title" :class="{ 'line-clamp': !expanded }">
          {{ item.summary }}
        </div>
        <!-- Expand hint -->
        <div class="feed-card-expand-hint" v-if="hasLongContent">
          {{ expanded ? '收起' : '展开全文' }}
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="feed-card-actions">
      <a v-if="item.sourceUrls[0]" :href="item.sourceUrls[0]" target="_blank" class="btn btn-ghost btn-sm feed-card-link" @click.stop>
        📎 原文
      </a>
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

// Pan with mouse
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

// Pinch zoom + pan for touch
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
  return text.length > 120 || (props.item.title || '').length > 40;
});

function onImageError() {
  // keep placeholder
}

function platformLabel(p: string): string {
  const map: Record<string, string> = { xiaohongshu: '小红书', bilibili: 'B站', douyin: '抖音' };
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
  margin: 0 12px 8px;
  padding: 12px;
  transition: all 0.2s;
}

.feed-card-inner {
  display: flex;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.feed-card-cover {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-border, #e5e7eb);
  cursor: zoom-in;
  transition: transform 0.15s;
}
.feed-card-cover:hover {
  transform: scale(1.05);
}

.feed-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-card-content {
  flex: 1;
  min-width: 0;
}

.feed-card-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text, #1a1a2e);
  margin-bottom: 2px;
}
.feed-card-title.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-card-meta {
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
  margin-top: 2px;
}

.feed-card-sep {
  margin: 0 4px;
  opacity: 0.4;
}

.feed-card-author {
  color: var(--color-primary, #6366f1);
}

.feed-card-summary {
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  line-height: 1.5;
  margin-top: 6px;
  white-space: pre-line;
}
.feed-card-summary.line-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-card-expand-hint {
  font-size: 11px;
  color: var(--color-primary, #6366f1);
  margin-top: 4px;
  cursor: pointer;
}

.feed-card-actions {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #f3f4f6);
}

.feed-card-link {
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
  text-decoration: none;
}

.feed-card-unread {
  border-left: 3px solid var(--color-primary, #6366f1);
}

.feed-card-expanded .feed-card-title.line-clamp {
  display: block;
  -webkit-line-clamp: unset;
  overflow: visible;
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
