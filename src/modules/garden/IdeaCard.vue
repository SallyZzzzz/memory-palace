<template>
  <div
    class="idea-card pixel-panel"
    :style="{ '--card-accent': cardColor }"
    @click="$emit('click')"
  >
    <!-- 顶部色条 -->
    <div class="card-accent-bar" />

    <!-- 表情图标 -->
    <div class="card-emoji">{{ entry.meta.coverEmoji || '💡' }}</div>

    <!-- 内容 -->
    <div class="card-title">{{ entry.title }}</div>
    <div class="card-preview">{{ preview }}</div>

    <!-- 标签 -->
    <div class="card-tags" v-if="entry.tags.length">
      <span v-for="tag in entry.tags.slice(0, 2)" :key="tag" class="pixel-tag">{{ tag }}</span>
    </div>

    <!-- 底部信息 -->
    <div class="card-footer">
      <span class="card-date">{{ formatDate(entry.updatedAt) }}</span>
      <button class="card-del" @click.stop="$emit('delete')" title="删除">🗑</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Entry } from '@/db/types'

const props = defineProps<{ entry: Entry }>()
defineEmits(['click', 'delete'])

const CARD_COLORS = ['#5aa02c', '#c8864a', '#6b8dd6', '#e67e22', '#9b59b6', '#e74c3c']

const cardColor = computed(() => {
  const idx = props.entry.id.charCodeAt(0) % CARD_COLORS.length
  return CARD_COLORS[idx]
})

const preview = computed(() => {
  const text = props.entry.content.replace(/[#*`>-]/g, '').trim()
  return text.length > 60 ? text.slice(0, 60) + '...' : text
})

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.idea-card {
  position: relative;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.1s, box-shadow 0.1s;
  --card-accent: var(--color-grass);
}
.idea-card:hover {
  transform: translateY(-3px);
  box-shadow: 6px 7px 0 rgba(0,0,0,0.3);
}

.card-accent-bar {
  height: 4px;
  background: var(--card-accent);
  margin: -1px -1px 0;
}

.card-emoji {
  font-size: 28px;
  padding: 10px 12px 4px;
}

.card-title {
  font-family: 'PixelFont', monospace;
  font-size: 11px;
  color: var(--color-panel-dark);
  padding: 0 12px 4px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-preview {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: var(--color-panel-border);
  padding: 0 12px 8px;
  line-height: 1.5;
  min-height: 32px;
}

.card-tags {
  display: flex;
  gap: 4px;
  padding: 0 12px 8px;
  flex-wrap: wrap;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(0,0,0,0.04);
  border-top: 1px solid rgba(139,99,64,0.15);
}

.card-date {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: var(--color-panel-border);
}

.card-del {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.5;
  transition: opacity 0.1s;
}
.card-del:hover { opacity: 1; }
</style>
