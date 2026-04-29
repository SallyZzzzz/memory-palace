<template>
  <ZoneLayout zone="lounge" @back="appStore.activeZone = null">
    <template #actions>
      <button class="pixel-btn" @click="addNote">+ 新建便利贴</button>
    </template>

    <!-- 便利贴画布 -->
    <div ref="canvasRef" class="lounge-canvas" @dblclick.self="addNote">
      <div
        v-for="note in notes"
        :key="note.id"
        class="sticky-note"
        :style="{
          left:       note.x + 'px',
          top:        note.y + 'px',
          background: note.color,
          zIndex:     note.id === activeId ? 10 : 1,
        }"
        @mousedown.stop="startDrag($event, note)"
        @dblclick.stop="editNote(note)"
      >
        <div class="note-header">
          <span class="note-drag-icon">⠿</span>
          <button class="note-del" @click.stop="deleteNote(note.id)" title="删除">✕</button>
        </div>
        <div class="note-title">{{ note.title }}</div>
        <div class="note-body">{{ note.content?.slice(0, 120) }}</div>
        <div class="note-edit-hint">双击编辑</div>
      </div>
    </div>

    <!-- 编辑模态框（inline，不用 Teleport）-->
    <template #modal>
      <div v-if="editTarget" class="modal-overlay" @click.self="editTarget = null">
        <div class="idea-modal pixel-panel">
          <div class="modal-header">
            <span>🗒️ 编辑便利贴</span>
            <button class="qa-close" @click="editTarget = null">✕</button>
          </div>
          <div class="color-row">
            <button
              v-for="c in NOTE_COLORS" :key="c"
              class="color-dot"
              :style="{ background: c, outline: editForm.color === c ? '3px solid #333' : 'none' }"
              @click="editForm.color = c"
            />
          </div>
          <input v-model="editForm.title" class="pixel-input" placeholder="标题..." style="margin-bottom:8px" />
          <textarea v-model="editForm.content" class="pixel-input" rows="5"
            placeholder="内容..." style="resize:vertical; margin-bottom:12px" />
          <div class="modal-actions">
            <button class="pixel-btn pixel-btn--danger" @click="deleteNote(editTarget!.id)">🗑️ 删除</button>
            <button class="pixel-btn pixel-btn--green" @click="saveNote">💾 保存</button>
          </div>
        </div>
      </div>
    </template>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/app'
import { getEntriesByZone, createEntry, updateEntry, softDeleteEntry } from '@/db'
import type { Entry } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'

const appStore  = useAppStore()
const canvasRef = ref<HTMLDivElement>()
const activeId  = ref<string | null>(null)

const NOTE_COLORS = ['#ffe066', '#a8e6cf', '#ffd3b6', '#d4a5d5', '#a0d8ef', '#f8b8b8']

// 本地响应式便利贴列表
interface NoteItem { id: string; title: string; content: string; x: number; y: number; color: string }
const notes = ref<NoteItem[]>([])

function refreshNotes() {
  notes.value = getEntriesByZone('lounge').map(e => ({
    id:      e.id,
    title:   e.title,
    content: e.content ?? '',
    x:       (e.meta?.x as number) ?? 40,
    y:       (e.meta?.y as number) ?? 40,
    color:   (e.meta?.color as string) ?? '#ffe066',
  }))
}

onMounted(refreshNotes)

// ── 自由拖拽（纯 mousedown/move/up）──────────────────
let dragging: NoteItem | null = null
let dragOffX = 0, dragOffY = 0
let canvasRect = { left: 0, top: 0 }

function startDrag(e: MouseEvent, note: NoteItem) {
  dragging     = note
  activeId.value = note.id
  const rect   = canvasRef.value!.getBoundingClientRect()
  canvasRect   = { left: rect.left, top: rect.top }
  dragOffX     = e.clientX - note.x
  dragOffY     = e.clientY - note.y
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup',   stopDrag)
}

function onDragMove(e: MouseEvent) {
  if (!dragging) return
  const n = notes.value.find(n => n.id === dragging!.id)
  if (!n) return
  n.x = e.clientX - dragOffX
  n.y = e.clientY - dragOffY
}

function stopDrag() {
  if (!dragging) return
  const n = notes.value.find(n => n.id === dragging!.id)
  if (n) {
    updateEntry(n.id, { meta: { x: n.x, y: n.y, color: n.color } })
  }
  dragging = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup',   stopDrag)
}

// ── 新建 ──────────────────────────────────────────────
function addNote() {
  const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]
  const x = 40 + Math.random() * 280
  const y = 40 + Math.random() * 160
  createEntry({
    zone: 'lounge', title: '新便利贴', content: '',
    entryType: 'note', tags: [],
    meta: { x, y, color },
  })
  refreshNotes()
  appStore.refreshStats()
}

// ── 编辑 / 保存 / 删除 ───────────────────────────────
const editTarget = ref<NoteItem | null>(null)
const editForm   = reactive({ title: '', content: '', color: '#ffe066' })

function editNote(note: NoteItem) {
  editTarget.value  = note
  editForm.title   = note.title
  editForm.content = note.content
  editForm.color   = note.color
}
function saveNote() {
  if (!editTarget.value) return
  updateEntry(editTarget.value.id, {
    title:   editForm.title,
    content: editForm.content,
    meta:    { x: editTarget.value.x, y: editTarget.value.y, color: editForm.color },
  })
  refreshNotes()
  editTarget.value = null
}
function deleteNote(id: string) {
  softDeleteEntry(id)
  refreshNotes()
  appStore.refreshStats()
  if (editTarget.value?.id === id) editTarget.value = null
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup',   stopDrag)
})
</script>

<style scoped>
/* ── 画布 ─────────────────────────────────────────── */
.lounge-canvas {
  width: 100%; height: 100%;
  position: relative;
  background: repeating-linear-gradient(
    0deg, rgba(139,99,64,0.06) 0px, rgba(139,99,64,0.06) 1px, transparent 1px, transparent 28px
  ),
  repeating-linear-gradient(
    90deg, rgba(139,99,64,0.06) 0px, rgba(139,99,64,0.06) 1px, transparent 1px, transparent 28px
  ),
  #e8e0d0;
  overflow: hidden;
  cursor: default;
}

/* ── 便利贴 ──────────────────────────────────────── */
.sticky-note {
  position: absolute;
  width: 168px;
  min-height: 110px;
  border: 2px solid rgba(100,70,30,0.35);
  border-radius: 2px;
  box-shadow: 3px 3px 8px rgba(0,0,0,0.18), inset 0 -2px 0 rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  padding: 0 0 6px;
  user-select: none;
  transition: box-shadow 0.12s;
}
.sticky-note:hover {
  box-shadow: 5px 5px 14px rgba(0,0,0,0.28);
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px 3px 8px;
  cursor: grab;
  background: rgba(0,0,0,0.06);
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.note-header:active { cursor: grabbing; }

.note-drag-icon {
  font-size: 12px;
  color: rgba(60,40,20,0.4);
  line-height: 1;
}
.note-del {
  background: none; border: none;
  font-size: 11px; color: rgba(60,40,20,0.4);
  cursor: pointer; line-height: 1; padding: 1px 2px;
  border-radius: 2px;
}
.note-del:hover { background: rgba(192,57,43,0.2); color: #c0392b; }

.note-title {
  font-family: 'PixelFont', monospace;
  font-size: 11px;
  font-weight: bold;
  color: #3d2e1a;
  padding: 6px 10px 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-body {
  font-family: monospace;
  font-size: 10px;
  color: #5a4030;
  padding: 2px 10px;
  flex: 1;
  overflow: hidden;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.note-edit-hint {
  font-size: 9px;
  color: rgba(60,40,20,0.3);
  text-align: right;
  padding: 2px 8px 0;
  font-family: monospace;
}

/* ── 模态框（inline，绝对定位于 zone-content）────── */
.modal-overlay {
  position: absolute; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
}
.idea-modal { width: 400px; padding: 16px; }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  font-family: 'PixelFont', monospace; font-size: 12px; color: var(--color-panel-dark);
}
.qa-close { background: none; border: none; cursor: pointer; color: var(--color-panel-border); font-size: 16px; }
.qa-close:hover { color: #c0392b; }
.color-row { display: flex; gap: 8px; margin-bottom: 10px; }
.color-dot {
  width: 24px; height: 24px; border: none; cursor: pointer;
  border-radius: 4px; box-shadow: 2px 2px 0 rgba(0,0,0,0.2);
  transition: transform 0.1s;
}
.color-dot:hover { transform: scale(1.2); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>