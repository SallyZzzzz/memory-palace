<template>
  <ZoneLayout
    zone="garden"
    :has-sub-page="!!(showCreate || editTarget)"
    @back="appStore.activeZone = null"
    @close-sub-page="closeModal"
  >
    <template #actions>
      <button class="pixel-btn pixel-btn--green" @click="showCreate = true">+ 新建想法</button>
      <select class="sort-select" v-model="sortBy">
        <option value="time">按时间</option>
        <option value="title">按标题</option>
      </select>
    </template>

    <!-- 花园内容 -->
    <div class="garden-content">
      <!-- 空状态 -->
      <div v-if="entries.length === 0" class="empty-state">
        <div class="empty-icon">🌱</div>
        <div class="empty-text">花园还是空的，<br/>种下第一颗灵感的种子吧！</div>
        <button class="pixel-btn pixel-btn--green" @click="showCreate = true">+ 新建想法</button>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="idea-grid">
        <IdeaCard
          v-for="entry in sortedEntries"
          :key="entry.id"
          :entry="entry"
          @click="editEntry(entry)"
          @delete="deleteEntry(entry.id)"
        />
      </div>
    </div>

    <!-- 弹窗：走 ZoneLayout #modal slot，不用 Teleport，避免残留板子 -->
    <template #modal>
      <div v-if="showCreate || editTarget" class="modal-overlay" @click.self="closeModal">
        <div class="idea-modal pixel-panel">
          <div class="modal-header">
            <span>{{ editTarget ? '✏️ 编辑想法' : '🌱 新建想法' }}</span>
            <button class="qa-close" @click="closeModal">✕</button>
          </div>

          <!-- 表情选择 -->
          <div class="emoji-row">
            <button
              v-for="e in EMOJIS"
              :key="e"
              class="emoji-btn"
              :class="{ active: form.emoji === e }"
              @click="form.emoji = e"
            >{{ e }}</button>
          </div>

          <input v-model="form.title" class="pixel-input" placeholder="想法标题..." style="margin-bottom:8px" />
          <textarea
            v-model="form.content"
            class="pixel-input"
            placeholder="详细内容（支持 Markdown 格式）..."
            rows="6"
            style="resize:vertical; margin-bottom:8px"
          />

          <!-- 标签 -->
          <div class="tag-input-row">
            <input
              v-model="tagInput"
              class="pixel-input tag-input"
              placeholder="添加标签..."
              @keydown.enter="addTag"
              @keydown.comma.prevent="addTag"
            />
            <button class="pixel-btn" @click="addTag">+ 标签</button>
          </div>
          <div class="tags-list">
            <span v-for="tag in form.tags" :key="tag" class="pixel-tag" @click="removeTag(tag)">
              {{ tag }} ✕
            </span>
          </div>

          <div class="modal-actions">
            <button v-if="editTarget" class="pixel-btn pixel-btn--danger" @click="deleteEntry(editTarget!.id); closeModal()">
              🗑️ 删除
            </button>
            <button class="pixel-btn pixel-btn--green" @click="saveEntry">
              💾 保存
            </button>
          </div>
        </div>
      </div>
    </template>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { getEntriesByZone, createEntry, updateEntry, softDeleteEntry } from '@/db'
import type { Entry } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'
import IdeaCard from './IdeaCard.vue'

const appStore = useAppStore()
const showCreate = ref(false)
const editTarget = ref<Entry | null>(null)
const sortBy = ref<'time' | 'title'>('time')
const tagInput = ref('')

const EMOJIS = ['💡', '🌟', '🎨', '🔥', '🌈', '⚡', '🎭', '🌀', '🧩', '✨']

const form = reactive({
  title: '',
  content: '',
  tags: [] as string[],
  emoji: '💡',
})

/* ── 手动刷新列表（computed + 非响应式 DB 不同步）── */
const entries = ref<Entry[]>([])
function refreshEntries() { entries.value = getEntriesByZone('garden') }
onMounted(refreshEntries)

const sortedEntries = computed(() =>
  [...entries.value].sort((a, b) =>
    sortBy.value === 'title'
      ? a.title.localeCompare(b.title)
      : b.updatedAt - a.updatedAt
  )
)

function editEntry(entry: Entry) {
  editTarget.value = entry
  form.title = entry.title
  form.content = entry.content
  form.tags = [...entry.tags]
  form.emoji = entry.meta.coverEmoji || '💡'
}

function closeModal() {
  showCreate.value = false
  editTarget.value = null
  form.title = ''
  form.content = ''
  form.tags = []
  form.emoji = '💡'
  tagInput.value = ''
}

function saveEntry() {
  if (!form.title.trim() && !form.content.trim()) return
  if (editTarget.value) {
    updateEntry(editTarget.value.id, {
      title: form.title || '未命名想法',
      content: form.content,
      tags: form.tags,
      meta: { ...editTarget.value.meta, coverEmoji: form.emoji },
    })
  } else {
    createEntry({
      zone: 'garden',
      title: form.title || '未命名想法',
      content: form.content,
      entryType: 'idea',
      tags: form.tags,
      meta: { coverEmoji: form.emoji },
    })
    appStore.refreshStats()
    appStore.setPetState('flash', 1500)
  }
  refreshEntries()   // ← 立即同步卡片列表
  closeModal()
}

function deleteEntry(id: string) {
  softDeleteEntry(id)
  refreshEntries()
  appStore.refreshStats()
}

function addTag() {
  const t = tagInput.value.trim().replace(',', '')
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ''
}
function removeTag(tag: string) {
  form.tags = form.tags.filter(t => t !== tag)
}
</script>

<style scoped>
.garden-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  background: linear-gradient(135deg, #f0f9e8 0%, #f5e6c8 100%);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}
.empty-icon { font-size: 48px; }
.empty-text {
  font-family: 'PixelFont', monospace;
  font-size: 11px;
  text-align: center;
  color: var(--color-panel-border);
  line-height: 1.8;
}

.idea-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.sort-select {
  background: rgba(0,0,0,0.2);
  border: 2px solid rgba(255,255,255,0.3);
  color: #fff;
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  padding: 4px 6px;
  cursor: pointer;
}

/* 弹窗 — absolute 相对于 zone-content，不泄漏到 body */
.modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.idea-modal {
  width: 460px;
  padding: 16px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-family: 'PixelFont', monospace;
  font-size: 12px;
  color: var(--color-panel-dark);
}
.qa-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-panel-border);
}
.emoji-row {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.emoji-btn {
  font-size: 18px;
  background: none;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 2px;
  transition: border-color 0.1s;
}
.emoji-btn.active {
  border-color: var(--color-grass);
  background: rgba(90,160,44,0.1);
}

.tag-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.tag-input { flex: 1; }
.tags-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  min-height: 24px;
}
.pixel-tag { cursor: pointer; }
.pixel-tag:hover { opacity: 0.7; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>