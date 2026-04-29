<template>
  <ZoneLayout zone="cellar" @back="appStore.activeZone = null">
    <template #actions>
      <button class="pixel-btn pixel-btn--danger" @click="confirmClear">🗑️ 清空地下室</button>
    </template>
    <div class="cellar-content">
      <div v-if="deleted.length === 0" class="empty-state">
        <div class="empty-icon">🕳️</div>
        <div class="empty-text">地下室空空的～<br/>删除的内容会在这里出现</div>
      </div>
      <div v-else class="cellar-list">
        <div class="cellar-header">共 {{ deleted.length }} 条归档内容</div>
        <div v-for="e in deleted" :key="e.id" class="cellar-item">
          <span class="cellar-icon">{{ ZONE_ICONS[e.zone as ZoneId] }}</span>
          <div class="cellar-info">
            <div class="cellar-title">{{ e.title }}</div>
            <div class="cellar-meta">
              来自{{ appStore.getZoneName(e.zone as ZoneId) }} · 删除于 {{ formatDate(e.deletedAt!) }}
            </div>
          </div>
          <div class="cellar-actions">
            <button class="pixel-btn pixel-btn--green" style="font-size:9px;padding:3px 8px" @click="restore(e.id)">还原</button>
            <button class="pixel-btn pixel-btn--danger" style="font-size:9px;padding:3px 8px" @click="permDelete(e.id)">永久删除</button>
          </div>
        </div>
      </div>
    </div>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/app'
import { getDeletedEntries, restoreEntry, permanentDeleteEntry, clearCellar } from '@/db'
import { ZONE_ICONS } from '@/db/types'
import type { ZoneId } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'

const appStore = useAppStore()
const deleted = computed(() => getDeletedEntries().sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)))

function restore(id: string) { restoreEntry(id); appStore.refreshStats() }
function permDelete(id: string) { permanentDeleteEntry(id); appStore.refreshStats() }
function confirmClear() {
  if (confirm('确定要永久删除所有归档内容吗？此操作不可撤销。')) {
    clearCellar()
    appStore.refreshStats()
    appStore.showButlerMessage('🧹 地下室已清空！')
  }
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.cellar-content { height: 100%; overflow-y: auto; padding: 16px; background: linear-gradient(135deg, #2c2c3a 0%, #3d3d4e 100%); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; }
.empty-icon { font-size: 48px; }
.empty-text { font-family: 'PixelFont', monospace; font-size: 11px; text-align: center; color: #888; line-height: 1.8; }
.cellar-header { font-family: 'PixelFont', monospace; font-size: 10px; color: #888; margin-bottom: 12px; }
.cellar-item { display: flex; align-items: center; gap: 12px; padding: 10px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.1); }
.cellar-item:hover { background: rgba(255,255,255,0.08); }
.cellar-icon { font-size: 20px; flex-shrink: 0; }
.cellar-info { flex: 1; min-width: 0; }
.cellar-title { font-family: 'PixelFont', monospace; font-size: 11px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cellar-meta { font-family: 'PixelFont', monospace; font-size: 9px; color: #666; margin-top: 2px; }
.cellar-actions { display: flex; gap: 6px; flex-shrink: 0; }
</style>
