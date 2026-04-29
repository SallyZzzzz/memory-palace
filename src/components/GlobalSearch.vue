<template>
  <div class="search-overlay" @click.self="$emit('close')">
    <div class="search-panel pixel-panel">
      <div class="search-header">
        <span class="search-icon">🔍</span>
        <input
          ref="inputRef"
          v-model="keyword"
          class="pixel-input search-input"
          placeholder="搜索所有内容..."
          @input="doSearch"
          @keydown.escape="$emit('close')"
        />
        <button class="search-close" @click="$emit('close')">✕</button>
      </div>

      <div v-if="keyword" class="search-results">
        <div v-if="results.length === 0" class="no-result">
          🌿 没有找到相关内容
        </div>
        <div
          v-for="item in results"
          :key="item.id"
          class="result-item"
          @click="openItem(item)"
        >
          <span class="result-zone-icon">{{ ZONE_ICONS[item.zone as ZoneId] }}</span>
          <div class="result-info">
            <div class="result-title">{{ item.title }}</div>
            <div class="result-meta">
              {{ appStore.getZoneName(item.zone as ZoneId) }} · {{ formatDate(item.updatedAt) }}
            </div>
          </div>
          <div class="result-tags">
            <span v-for="tag in item.tags.slice(0, 2)" :key="tag" class="pixel-tag">{{ tag }}</span>
          </div>
        </div>
      </div>

      <div v-else class="search-tips">
        <div class="tip-item">📖 输入关键词搜索所有区域的内容</div>
        <div class="tip-item">🏷️ 支持搜索标题、内容、标签</div>
        <div class="tip-item">⌨️ ESC 关闭搜索</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { searchEntries } from '@/db'
import { ZONE_ICONS } from '@/db/types'
import type { Entry, ZoneId } from '@/db/types'

const emit = defineEmits(['close'])
const appStore = useAppStore()
const keyword = ref('')
const results = ref<Entry[]>([])
const inputRef = ref<HTMLInputElement>()

onMounted(() => inputRef.value?.focus())

function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    return
  }
  results.value = searchEntries(keyword.value).slice(0, 20)
}

function openItem(item: Entry) {
  appStore.openZone(item.zone as ZoneId)
  emit('close')
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.search-panel {
  width: 560px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 2px solid var(--color-panel-border);
}
.search-icon { font-size: 16px; }
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  box-shadow: none;
  font-size: 12px;
}
.search-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-panel-border);
  font-size: 14px;
}
.search-close:hover { color: #c0392b; }

.search-results {
  overflow-y: auto;
  max-height: 50vh;
  padding: 8px 0;
}

.no-result {
  text-align: center;
  padding: 24px;
  font-family: 'PixelFont', monospace;
  font-size: 11px;
  color: var(--color-panel-border);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(139,99,64,0.15);
  transition: background 0.1s;
}
.result-item:hover {
  background: rgba(200,134,74,0.1);
}
.result-zone-icon { font-size: 18px; flex-shrink: 0; }
.result-info { flex: 1; min-width: 0; }
.result-title {
  font-family: 'PixelFont', monospace;
  font-size: 11px;
  color: var(--color-panel-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.result-meta {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: var(--color-panel-border);
  margin-top: 2px;
}
.result-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.search-tips {
  padding: 16px;
}
.tip-item {
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  color: var(--color-panel-border);
  margin-bottom: 8px;
}
</style>
