<template>
  <ZoneLayout zone="lab" @back="appStore.activeZone = null" @close-sub-page="selectedIds = []">
    <template #actions>
      <button class="pixel-btn" :class="{ 'pixel-btn--green': viewMode === 'list' }" @click="viewMode = 'list'">📋 列表</button>
      <button class="pixel-btn" :class="{ 'pixel-btn--green': viewMode === 'graph' }" @click="viewMode = 'graph'">🔗 图谱</button>
    </template>
    <div class="lab-content">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'" class="lab-list">
        <div class="lab-section" v-for="zone in ALL_ZONES" :key="zone">
          <div class="lab-section-title">{{ ZONE_ICONS[zone] }} {{ appStore.getZoneName(zone) }}</div>
          <div class="lab-items">
            <div
              v-for="e in getEntries(zone)"
              :key="e.id"
              class="lab-item"
              :class="{ selected: selectedIds.includes(e.id) }"
              @click="toggleSelect(e.id)"
            >
              <span class="lab-item-emoji">{{ e.meta.coverEmoji || ZONE_ICONS[zone] }}</span>
              <span class="lab-item-title">{{ e.title }}</span>
              <span v-if="selectedIds.includes(e.id)" class="check">✓</span>
            </div>
          </div>
        </div>
        <!-- 建立关联 -->
        <div v-if="selectedIds.length >= 2" class="relation-actions">
          <span class="rel-hint">已选择 {{ selectedIds.length }} 个条目</span>
          <input v-model="relLabel" class="pixel-input rel-input" placeholder="关联名称（可选）" />
          <button class="pixel-btn pixel-btn--green" @click="createRelationship">🔗 建立关联</button>
          <button class="pixel-btn" @click="selectedIds = []">取消</button>
        </div>
      </div>

      <!-- 图谱视图 -->
      <div v-else ref="graphWrap" class="lab-graph">
        <svg :width="svgW" :height="svgH">
          <!-- 关联线 -->
          <line
            v-for="rel in allRelations"
            :key="rel.id"
            :x1="nodePos(rel.sourceId)?.x ?? 0"
            :y1="nodePos(rel.sourceId)?.y ?? 0"
            :x2="nodePos(rel.targetId)?.x ?? 0"
            :y2="nodePos(rel.targetId)?.y ?? 0"
            stroke="#8b6340" stroke-width="2" stroke-dasharray="4,3" opacity="0.6"
          />
          <text
            v-for="rel in allRelations"
            :key="'l' + rel.id"
            :x="((nodePos(rel.sourceId)?.x ?? 0) + (nodePos(rel.targetId)?.x ?? 0)) / 2"
            :y="((nodePos(rel.sourceId)?.y ?? 0) + (nodePos(rel.targetId)?.y ?? 0)) / 2 - 6"
            text-anchor="middle" font-size="9" fill="#8b6340" font-family="monospace"
          >{{ rel.label }}</text>
          <!-- 节点 -->
          <g v-for="(node, i) in graphNodes" :key="node.id" @click="selectedNode = node">
            <circle :cx="node.x" :cy="node.y" r="24"
              :fill="ZONE_COLORS[node.zone]"
              :stroke="selectedNode?.id === node.id ? '#f5c518' : '#5c3d1e'"
              :stroke-width="selectedNode?.id === node.id ? 3 : 2"
            />
            <text :x="node.x" :y="node.y + 4" text-anchor="middle" font-size="10" fill="#fff" font-family="monospace">
              {{ node.title.slice(0, 6) }}
            </text>
          </g>
        </svg>
        <!-- 节点详情 -->
        <div v-if="selectedNode" class="node-detail pixel-panel">
          <div class="node-title">{{ selectedNode.title }}</div>
          <div class="node-zone">{{ ZONE_ICONS[selectedNode.zone] }} {{ appStore.getZoneName(selectedNode.zone) }}</div>
          <div class="node-relations">
            关联数: {{ getNodeRelations(selectedNode.id).length }}
          </div>
        </div>
      </div>
    </div>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import { getAllEntries, getAllRelations, createRelation, getEntriesByZone } from '@/db'
import { ZONE_ICONS, ZONE_COLORS } from '@/db/types'
import type { ZoneId, Entry } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'

const appStore = useAppStore()
const viewMode = ref<'list' | 'graph'>('list')
const selectedIds = ref<string[]>([])
const relLabel = ref('')
const selectedNode = ref<any>(null)
const graphWrap = ref<HTMLDivElement>()

const ALL_ZONES: ZoneId[] = ['garden', 'store', 'lounge', 'study']
const svgW = 700, svgH = 500

const allEntries = computed(() => getAllEntries().filter(e => e.deletedAt === null))
const allRelations = computed(() => getAllRelations())

function getEntries(zone: ZoneId) { return getEntriesByZone(zone) }
function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}
function createRelationship() {
  for (let i = 0; i < selectedIds.value.length - 1; i++) {
    createRelation({ sourceId: selectedIds.value[i], targetId: selectedIds.value[i+1], relType: 'manual', label: relLabel.value || '关联', strength: 1 })
  }
  appStore.refreshStats()
  selectedIds.value = []
  relLabel.value = ''
  appStore.showButlerMessage('🔗 关联建立成功！可在图谱视图查看关系网络。')
}

// 图谱布局（简单圆形布局）
const graphNodes = computed(() => {
  return allEntries.value.slice(0, 30).map((e, i) => {
    const angle = (i / Math.min(allEntries.value.length, 30)) * Math.PI * 2
    const r = 180
    return { id: e.id, title: e.title, zone: e.zone as ZoneId, x: svgW/2 + Math.cos(angle)*r, y: svgH/2 + Math.sin(angle)*r }
  })
})

function nodePos(id: string) { return graphNodes.value.find(n => n.id === id) }
function getNodeRelations(id: string) { return allRelations.value.filter(r => r.sourceId === id || r.targetId === id) }
</script>

<style scoped>
.lab-content { height: 100%; overflow: hidden; }
.lab-list { height: 100%; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; background: linear-gradient(135deg, #fef0e0 0%, #f5e6c8 100%); }
.lab-section-title { font-family: 'PixelFont', monospace; font-size: 11px; color: var(--color-panel-border); margin-bottom: 6px; }
.lab-items { display: flex; flex-wrap: wrap; gap: 6px; }
.lab-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border: 2px solid var(--color-panel-border); font-family: 'PixelFont', monospace; font-size: 10px; cursor: pointer; background: rgba(255,255,255,0.6); }
.lab-item:hover { background: rgba(200,134,74,0.1); }
.lab-item.selected { background: rgba(90,160,44,0.15); border-color: var(--color-grass); }
.lab-item-emoji { font-size: 14px; }
.check { color: var(--color-grass); font-weight: bold; }
.relation-actions { position: sticky; bottom: 0; display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--color-panel-bg); border-top: 3px solid var(--color-panel-border); }
.rel-hint { font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-grass); }
.rel-input { width: 160px; }
.lab-graph { height: 100%; position: relative; background: #2c2c3a; }
.lab-graph svg { position: absolute; inset: 0; }
.node-detail { position: absolute; right: 16px; top: 16px; width: 160px; padding: 12px; }
.node-title { font-family: 'PixelFont', monospace; font-size: 11px; color: var(--color-panel-dark); margin-bottom: 4px; }
.node-zone { font-family: 'PixelFont', monospace; font-size: 9px; color: var(--color-panel-border); }
.node-relations { font-family: 'PixelFont', monospace; font-size: 9px; color: var(--color-grass); margin-top: 4px; }
</style>
