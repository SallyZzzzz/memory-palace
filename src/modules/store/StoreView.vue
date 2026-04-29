<template>
  <ZoneLayout zone="store" @back="appStore.activeZone = null">
    <template #actions>
      <button class="pixel-btn" @click="() => openFilePicker(false)">📂 选择文件</button>
      <button class="pixel-btn" @click="openAddModal">+ 手动添加</button>
    </template>

    <div class="store-content">
      <!-- 气泡提示 -->
      <transition name="toast-fade">
        <div v-if="toastMsg" class="store-toast">{{ toastMsg }}</div>
      </transition>

      <!-- 分类 Tab -->
      <div class="cat-tabs">
        <button
          v-for="c in ALL_CATS" :key="c.id"
          class="cat-tab"
          :class="{ active: activeCat === c.id }"
          @click="activeCat = c.id"
        >{{ c.icon }} {{ c.label }}</button>
      </div>

      <!-- 列表 / 空态 -->
      <div v-if="filteredEntries.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-text">
          {{ activeCat === 'all' ? '仓库还是空的，把素材和资源存进来吧！' : `「${catLabel}」分类还没有内容` }}
        </div>
        <button class="pixel-btn" @click="() => openFilePicker(false)">📂 选择文件存入</button>
      </div>
      <div v-else class="resource-table">
        <div class="table-header">
          <span></span>
          <span>名称</span>
          <span>分类</span>
          <span>路径 / 链接</span>
          <span>时间</span>
          <span></span>
        </div>
        <div
          v-for="e in filteredEntries" :key="e.id"
          class="table-row"
          @click="openEditModal(e)"
        >
          <span class="res-icon">{{ typeIcon(e.meta?.mimeType) }}</span>
          <span class="res-name">{{ e.title }}</span>
          <span class="res-cat">
            <span class="cat-badge" :style="{ background: catColor(e.meta?.category) }">
              {{ catIcon(e.meta?.category) }} {{ catLabelOf(e.meta?.category) }}
            </span>
          </span>
          <span class="res-url">{{ ((e.meta?.url || e.meta?.filePath) as string || '').slice(0, 26) }}</span>
          <span class="res-date">{{ formatDate(e.createdAt) }}</span>
          <button class="card-del" @click.stop="doDelete(e.id)">🗑</button>
        </div>
      </div>

      <!-- 拖拽区 -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': isDraggingOver }"
        @dragover.prevent="isDraggingOver = true"
        @dragleave="isDraggingOver = false"
        @drop.prevent="onDrop"
      >
        📂 也可以直接拖拽文件到此处
      </div>
    </div>

    <!-- 新建 / 编辑模态框 -->
    <template #modal>
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="idea-modal pixel-panel">
          <div class="modal-header">
            <span>{{ editTarget ? '✏️ 编辑资源' : '📦 添加资源' }}</span>
            <button class="qa-close" @click="closeModal">✕</button>
          </div>

          <!-- 文件选择行 -->
          <div v-if="!editTarget" class="file-pick-row">
            <div class="file-pick-display">
              {{ form.filePath || '未选择文件' }}
            </div>
            <button class="pixel-btn" style="flex-shrink:0" @click="openFilePicker(true)">
              📂 浏览…
            </button>
          </div>

          <input v-model="form.title" class="pixel-input" placeholder="资源名称..." style="margin-bottom:8px" />

          <!-- 分类选择 -->
          <div class="cat-pick-row">
            <span class="field-label">分类：</span>
            <button
              v-for="c in USER_CATS" :key="c.id"
              class="cat-pick-btn"
              :class="{ active: form.category === c.id }"
              :style="{ borderColor: form.category === c.id ? c.color : 'transparent', background: form.category === c.id ? c.color + '22' : '' }"
              @click="form.category = c.id"
            >{{ c.icon }} {{ c.label }}</button>
          </div>

          <input v-model="form.url" class="pixel-input" placeholder="或输入链接 URL（可选）..." style="margin-bottom:8px" />
          <textarea v-model="form.note" class="pixel-input" rows="2"
            placeholder="备注（可选）..." style="resize:none; margin-bottom:12px" />

          <div class="modal-actions">
            <button v-if="editTarget" class="pixel-btn pixel-btn--danger"
              @click="doDelete(editTarget!.id); closeModal()">🗑️ 删除</button>
            <button class="pixel-btn pixel-btn--green" @click="saveEntry">💾 保存</button>
          </div>
        </div>
      </div>
    </template>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { open as tauriOpen } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '@/store/app'
import { getEntriesByZone, createEntry, updateEntry, softDeleteEntry } from '@/db'
import type { Entry } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'

const appStore = useAppStore()

/* ── 分类定义 ─────────────────────────────────────────────── */
const USER_CATS = [
  { id: 'doc',    label: '文档',   icon: '📄', color: '#6c8ebf' },
  { id: 'image',  label: '图片',   icon: '🖼️', color: '#82b366' },
  { id: 'video',  label: '视频',   icon: '🎬', color: '#d6963a' },
  { id: 'audio',  label: '音频',   icon: '🎵', color: '#9673a6' },
  { id: 'link',   label: '链接',   icon: '🔗', color: '#23a4b8' },
  { id: 'other',  label: '其他',   icon: '📦', color: '#8d7b68' },
]
const ALL_CATS = [{ id: 'all', label: '全部', icon: '🗂️', color: '#555' }, ...USER_CATS]

function catLabelOf(id?: string) { return USER_CATS.find(c => c.id === id)?.label ?? '其他' }
function catIcon(id?: string)    { return USER_CATS.find(c => c.id === id)?.icon  ?? '📦' }
function catColor(id?: string)   { return (USER_CATS.find(c => c.id === id)?.color ?? '#8d7b68') + '33' }

const activeCat = ref('all')
const catLabel  = computed(() => ALL_CATS.find(c => c.id === activeCat.value)?.label ?? '')

/* ── 列表 ─────────────────────────────────────────────────── */
const entries = ref<Entry[]>([])
function refreshEntries() { entries.value = getEntriesByZone('store') }
onMounted(refreshEntries)

const filteredEntries = computed(() =>
  activeCat.value === 'all'
    ? entries.value
    : entries.value.filter(e => (e.meta?.category ?? 'other') === activeCat.value)
)

/* ── 气泡 ──────────────────────────────────────────────────── */
const toastMsg = ref('')
let _tt = 0
function showToast(msg: string) {
  toastMsg.value = msg
  clearTimeout(_tt)
  _tt = window.setTimeout(() => { toastMsg.value = '' }, 2500)
}

/* ── 工具 ──────────────────────────────────────────────────── */
function typeIcon(mime?: string) {
  if (!mime) return '📄'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('video')) return '🎬'
  if (mime.includes('audio')) return '🎵'
  if (mime.includes('pdf'))   return '📕'
  return '📄'
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', txt: 'text/plain', md: 'text/markdown',
  }
  return map[ext] ?? 'application/octet-stream'
}
function guessCategory(mime: string): string {
  if (mime.includes('image')) return 'image'
  if (mime.includes('video')) return 'video'
  if (mime.includes('audio')) return 'audio'
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text') || mime.includes('sheet')) return 'doc'
  return 'other'
}

/* ── 系统文件选择器 ────────────────────────────────────────── */
const isDraggingOver = ref(false)

// inModal = true：在弹窗内选文件，只选一个并填入表单
// inModal = false（默认）：直接选多文件批量存入
async function openFilePicker(inModal = false) {
  try {
    const selected = await tauriOpen({
      multiple: !inModal,
      filters: [{
        name: '所有文件',
        extensions: ['*'],
      }],
    })
    if (!selected) return

    if (inModal) {
      // 单文件 → 填入表单
      const path = selected as string
      const name = path.split(/[\\/]/).pop() ?? path
      const mime = guessMime(name)
      form.filePath  = path
      form.title     = form.title || name
      form.mimeType  = mime
      form.category  = form.category || guessCategory(mime)
    } else {
      // 多文件 → 直接批量存入
      const paths = (Array.isArray(selected) ? selected : [selected]) as string[]
      paths.forEach(path => {
        const name = path.split(/[\\/]/).pop() ?? path
        const mime = guessMime(name)
        createEntry({
          zone: 'store', title: name, content: '',
          entryType: 'resource', tags: [],
          meta: { mimeType: mime, filePath: path, category: guessCategory(mime) },
        })
      })
      refreshEntries()
      appStore.refreshStats()
      showToast(paths.length === 1
        ? `📦 「${paths[0].split(/[\\/]/).pop()}」已存入仓库！`
        : `📦 ${paths.length} 个文件已存入仓库！`)
    }
  } catch (e) {
    console.warn('文件选择取消或失败', e)
  }
}

/* ── 拖拽区 ────────────────────────────────────────────────── */
function onDrop(e: DragEvent) {
  isDraggingOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  Array.from(files).forEach(f => {
    const mime = f.type || guessMime(f.name)
    createEntry({
      zone: 'store', title: f.name, content: '',
      entryType: 'resource', tags: [],
      meta: { mimeType: mime, filePath: f.name, fileSize: f.size, category: guessCategory(mime) },
    })
  })
  refreshEntries()
  appStore.refreshStats()
  const n = files.length
  showToast(n === 1 ? `📦 「${files[0].name}」已存入仓库！` : `📦 ${n} 个文件已存入仓库！`)
}

/* ── 模态框 ────────────────────────────────────────────────── */
const showModal  = ref(false)
const editTarget = ref<Entry | null>(null)
const form = reactive({ title: '', url: '', filePath: '', mimeType: '', category: 'other', note: '' })

function openAddModal() {
  editTarget.value = null
  Object.assign(form, { title: '', url: '', filePath: '', mimeType: '', category: 'other', note: '' })
  showModal.value = true
}
function openEditModal(e: Entry) {
  editTarget.value = e
  Object.assign(form, {
    title:    e.title,
    url:      (e.meta?.url as string) ?? '',
    filePath: (e.meta?.filePath as string) ?? '',
    mimeType: (e.meta?.mimeType as string) ?? '',
    category: (e.meta?.category as string) ?? 'other',
    note:     (e.meta?.note as string) ?? '',
  })
  showModal.value = true
}
function saveEntry() {
  const title = form.title.trim() || form.filePath.split(/[\\/]/).pop() || '未命名资源'
  if (!title && !form.url && !form.filePath) return
  const meta = {
    url:      form.url,
    filePath: form.filePath,
    mimeType: form.mimeType || guessMime(form.filePath || form.title),
    category: form.category,
    note:     form.note,
  }
  if (editTarget.value) {
    updateEntry(editTarget.value.id, { title, meta: { ...editTarget.value.meta, ...meta } })
    showToast('✅ 资源已更新！')
  } else {
    createEntry({ zone: 'store', title, content: '', entryType: 'resource', tags: [], meta })
    appStore.refreshStats()
    showToast(`📦 「${title}」已存入仓库！`)
  }
  refreshEntries()
  closeModal()
}
function doDelete(id: string) {
  softDeleteEntry(id)
  refreshEntries()
  appStore.refreshStats()
}
function closeModal() {
  showModal.value  = false
  editTarget.value = null
}
</script>

<style scoped>
.store-content {
  height: 100%; overflow-y: auto; padding: 16px;
  background: linear-gradient(135deg, #fdf0e0 0%, #f5e6c8 100%);
  display: flex; flex-direction: column; gap: 10px;
  position: relative;
}

/* ── 气泡 ────────────────────────────────────────── */
.store-toast {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  background: #3d2e1a; color: #fff;
  font-family: 'PixelFont', monospace; font-size: 11px;
  padding: 8px 18px; border-radius: 4px; z-index: 100;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.3); pointer-events: none; white-space: nowrap;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity .3s, transform .3s; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.toast-fade-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-8px); }

/* ── 分类 Tab ────────────────────────────────────── */
.cat-tabs {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding-bottom: 4px;
  border-bottom: 2px solid rgba(139,99,64,0.2);
}
.cat-tab {
  font-family: 'PixelFont', monospace; font-size: 10px;
  padding: 4px 10px; border: 2px solid rgba(139,99,64,0.25);
  background: rgba(255,255,255,0.5); cursor: pointer;
  border-radius: 2px; transition: all 0.15s;
  color: var(--color-panel-border);
}
.cat-tab.active, .cat-tab:hover {
  background: var(--color-wood); color: #fff;
  border-color: var(--color-wood);
}

/* ── 空态 ────────────────────────────────────────── */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 14px; }
.empty-icon { font-size: 44px; }
.empty-text { font-family: 'PixelFont', monospace; font-size: 11px; text-align: center; color: var(--color-panel-border); line-height: 1.8; }

/* ── 表格 ────────────────────────────────────────── */
.resource-table { background: rgba(255,255,255,0.5); border: 2px solid var(--color-panel-border); }
.table-header {
  display: grid;
  grid-template-columns: 28px 1fr 80px 150px 64px 28px;
  padding: 5px 10px;
  background: var(--color-wood); color: #fff;
  font-family: 'PixelFont', monospace; font-size: 10px; gap: 8px;
}
.table-row {
  display: grid;
  grid-template-columns: 28px 1fr 80px 150px 64px 28px;
  padding: 7px 10px;
  border-bottom: 1px solid rgba(139,99,64,0.12);
  cursor: pointer; gap: 8px; align-items: center;
  font-family: 'PixelFont', monospace; font-size: 10px;
}
.table-row:hover { background: rgba(200,134,74,0.08); }
.res-icon { font-size: 15px; }
.res-name { color: var(--color-panel-dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-url, .res-date { color: var(--color-panel-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-cat { overflow: hidden; }
.cat-badge {
  display: inline-block;
  font-family: 'PixelFont', monospace; font-size: 9px;
  padding: 2px 6px; border-radius: 3px;
  white-space: nowrap;
}
.card-del { background: none; border: none; cursor: pointer; opacity: 0.45; font-size: 13px; }
.card-del:hover { opacity: 1; }

/* ── 拖拽区 ──────────────────────────────────────── */
.drop-zone {
  border: 3px dashed var(--color-wood); padding: 14px 16px;
  text-align: center;
  font-family: 'PixelFont', monospace; font-size: 10px;
  color: var(--color-panel-border); transition: all 0.2s; border-radius: 4px;
}
.drop-zone--active {
  border-color: var(--color-grass); background: rgba(90,160,44,0.08);
  color: var(--color-grass); transform: scale(1.01);
}

/* ── 模态框 ──────────────────────────────────────── */
.modal-overlay {
  position: absolute; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
}
.idea-modal { width: 440px; padding: 16px; }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  font-family: 'PixelFont', monospace; font-size: 12px; color: var(--color-panel-dark);
}
.qa-close { background: none; border: none; cursor: pointer; color: var(--color-panel-border); font-size: 16px; }
.qa-close:hover { color: #c0392b; }

.file-pick-row {
  display: flex; gap: 8px; align-items: center; margin-bottom: 8px;
}
.file-pick-display {
  flex: 1; padding: 7px 10px;
  background: rgba(0,0,0,0.04);
  border: 2px solid var(--color-panel-border);
  font-family: monospace; font-size: 10px;
  color: var(--color-panel-border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.field-label {
  font-family: 'PixelFont', monospace; font-size: 10px;
  color: var(--color-panel-border); flex-shrink: 0;
}
.cat-pick-row {
  display: flex; gap: 6px; align-items: center;
  flex-wrap: wrap; margin-bottom: 10px;
}
.cat-pick-btn {
  font-family: 'PixelFont', monospace; font-size: 10px;
  padding: 3px 9px; border: 2px solid transparent;
  background: rgba(0,0,0,0.04); cursor: pointer;
  border-radius: 3px; transition: all 0.12s;
}
.cat-pick-btn:hover { opacity: 0.85; }
.cat-pick-btn.active { font-weight: bold; }

.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
</style>