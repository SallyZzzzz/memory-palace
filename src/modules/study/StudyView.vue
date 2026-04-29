<template>
  <ZoneLayout
    zone="study"
    :has-sub-page="!!activeDoc"
    @back="appStore.activeZone = null"
    @close-sub-page="closeDoc"
  >
    <!-- 面包屑子层：文档名 -->
    <template v-if="activeDoc" #breadcrumb>
      <button class="crumb-doc-back crumb-sub" @click="closeDoc" title="返回文档列表 (ESC)">
        ← {{ docTitle || '未命名文档' }}
      </button>
    </template>

    <template #actions>
      <button class="pixel-btn" @click="newDoc">+ 新建文档</button>
    </template>

    <div class="study-layout">
      <!-- 文档列表侧边栏 -->
      <div class="doc-sidebar">
        <div v-if="entries.length === 0" class="sidebar-empty">暂无文档</div>
        <div
          v-for="doc in entries"
          :key="doc.id"
          class="doc-item"
          :class="{ active: activeDoc?.id === doc.id }"
          @click="openDoc(doc)"
        >
          <span>📄</span>
          <span class="doc-item-title">{{ doc.title }}</span>
          <button class="del-btn" @click.stop="deleteDoc(doc.id)">✕</button>
        </div>
      </div>

      <!-- 编辑区 -->
      <div class="doc-editor-wrap">
        <div v-if="!activeDoc" class="editor-empty">
          <div class="empty-icon">📖</div>
          <div>选择文档或新建一篇</div>
          <div class="editor-hint">点击左侧文档，或点击「新建文档」开始</div>
        </div>
        <div v-else class="editor-inner">
          <!-- 文档内顶栏：返回列表 + 标题 + 工具栏 -->
          <div class="doc-header">
            <button class="doc-back-btn" @click="closeDoc" title="返回文档列表 (ESC)">
              ← 返回列表
            </button>
            <input
              v-model="docTitle"
              class="doc-title-input"
              placeholder="文档标题..."
              @blur="saveDoc"
            />
          </div>
          <div class="editor-toolbar">
            <button class="tool-btn" @click="editor?.chain().focus().toggleBold().run()"><b>B</b></button>
            <button class="tool-btn" @click="editor?.chain().focus().toggleItalic().run()"><i>I</i></button>
            <button class="tool-btn" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
            <button class="tool-btn" @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
            <button class="tool-btn" @click="editor?.chain().focus().toggleBulletList().run()">• 列表</button>
            <button class="tool-btn" @click="editor?.chain().focus().toggleCodeBlock().run()">{ }</button>
            <div class="toolbar-sep" />
            <button class="tool-btn tool-btn--save" @click="saveDoc" title="保存 (Ctrl+S)">💾 保存</button>
            <button class="tool-btn" @click="exportDoc" title="导出为文本">⬇ 导出</button>
            <span class="word-count">{{ wordCount }} 字</span>
          </div>
          <div class="tiptap-wrap">
            <editor-content :editor="editor" class="tiptap-editor" />
          </div>
        </div>
      </div>
    </div>
  </ZoneLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/store/app'
import { getEntriesByZone, createEntry, updateEntry, softDeleteEntry } from '@/db'
import type { Entry } from '@/db/types'
import ZoneLayout from '@/components/ZoneLayout.vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const appStore = useAppStore()
const activeDoc = ref<Entry | null>(null)
const docTitle  = ref('')

// 本地响应式列表——updateEntry 后手动刷新，确保侧边栏实时更新
const entries = ref<Entry[]>([])
function refreshEntries() {
  entries.value = getEntriesByZone('study')
}

const editor = useEditor({
  extensions: [StarterKit],
  content: '',
  onUpdate: () => { saveDoc() },
})

const wordCount = computed(() => editor.value?.getText().replace(/\s/g, '').length ?? 0)

function newDoc() {
  const doc = createEntry({ zone: 'study', title: '新文档', content: '', entryType: 'doc', tags: [], meta: {} })
  refreshEntries()
  appStore.refreshStats()
  openDoc(doc)
}

function openDoc(doc: Entry) {
  activeDoc.value = doc
  docTitle.value  = doc.title
  editor.value?.commands.setContent(doc.content || '')
}

function saveDoc() {
  if (!activeDoc.value) return
  const title = docTitle.value.trim() || '未命名文档'
  updateEntry(activeDoc.value.id, {
    title,
    content: editor.value?.getHTML() ?? '',
  })
  // 同步更新本地列表，让侧边栏标题即时反映修改
  refreshEntries()
}

/** 关闭文档编辑，回到列表（先保存） */
function closeDoc() {
  saveDoc()
  activeDoc.value = null
  editor.value?.commands.setContent('')
}

function deleteDoc(id: string) {
  softDeleteEntry(id)
  refreshEntries()
  appStore.refreshStats()
  if (activeDoc.value?.id === id) { closeDoc() }
}

function exportDoc() {
  if (!activeDoc.value) return
  const blob = new Blob([editor.value?.getText() ?? ''], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${docTitle.value || '文档'}.txt`
  a.click()
}

// Ctrl+S 快捷保存
function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveDoc() }
}

onMounted(() => {
  refreshEntries()
  document.addEventListener('keydown', onKeyDown)
  // 首次打开书房时，自动创建一篇欢迎文档
  if (entries.value.length === 0) {
    const welcome = createEntry({
      zone: 'study',
      title: '我的第一篇笔记',
      content: '<p>欢迎来到书房 📚</p><p>这里是你的私人写作空间，记录想法、整理知识都可以。</p><p>点击左侧文档名或「新建文档」开始创作吧！</p>',
      entryType: 'doc',
      tags: [],
      meta: {},
    })
    refreshEntries()
    appStore.refreshStats()
    openDoc(welcome)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.study-layout { display: flex; height: 100%; }
.doc-sidebar { width: 200px; border-right: 3px solid var(--color-panel-border); background: rgba(0,0,0,0.04); overflow-y: auto; }
.sidebar-empty { padding: 16px; font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-panel-border); text-align: center; }
.doc-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; border-bottom: 1px solid rgba(139,99,64,0.1); font-family: 'PixelFont', monospace; font-size: 10px; }
.doc-item:hover, .doc-item.active { background: rgba(200,134,74,0.12); }
.doc-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.del-btn { background: none; border: none; cursor: pointer; opacity: 0.4; font-size: 10px; }
.del-btn:hover { opacity: 1; color: #c0392b; }
.doc-editor-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.editor-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; font-family: 'PixelFont', monospace; font-size: 11px; color: var(--color-panel-border); }
.empty-icon { font-size: 40px; }
.editor-hint { font-size: 9px; color: var(--color-panel-border); opacity: 0.7; }
.editor-inner { display: flex; flex-direction: column; height: 100%; }

/* 文档内顶栏 */
.doc-header {
  display: flex;
  align-items: center;
  gap: 0;
  border-bottom: 3px solid var(--color-panel-border);
}
.doc-back-btn {
  flex-shrink: 0;
  background: var(--color-panel-bg);
  border: none;
  border-right: 2px solid var(--color-panel-border);
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  padding: 10px 12px;
  cursor: pointer;
  color: var(--color-panel-border);
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.doc-back-btn:hover {
  background: var(--color-wood);
  color: #fff;
}

.doc-title-input {
  flex: 1;
  font-family: 'PixelFont', monospace;
  font-size: 14px;
  border: none;
  padding: 10px 16px;
  background: transparent;
  color: var(--color-panel-dark);
  outline: none;
}

/* 面包屑文档按钮 */
.crumb-doc-back {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: rgba(255,255,255,0.85);
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.12s;
}
.crumb-doc-back:hover { color: #fff; text-decoration: underline; }

.editor-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-bottom: 2px solid var(--color-panel-border); background: rgba(0,0,0,0.03); flex-wrap: wrap; }
.tool-btn { background: none; border: 2px solid var(--color-panel-border); font-family: 'PixelFont', monospace; font-size: 10px; padding: 3px 8px; cursor: pointer; }
.tool-btn:hover { background: var(--color-wood); color: #fff; border-color: var(--color-wood); }
.tool-btn--save { background: var(--color-grass); color: #fff; border-color: var(--color-grass-dark); }
.tool-btn--save:hover { background: var(--color-grass-dark); }
.toolbar-sep { width: 1px; height: 18px; background: var(--color-panel-border); margin: 0 4px; opacity: 0.4; }
.word-count { margin-left: auto; font-family: 'PixelFont', monospace; font-size: 9px; color: var(--color-panel-border); }
.tiptap-wrap { flex: 1; overflow-y: auto; padding: 16px; }
:deep(.tiptap-editor) { font-family: 'Georgia', serif; font-size: 13px; line-height: 1.8; color: var(--color-panel-dark); outline: none; min-height: 200px; }
:deep(.tiptap-editor h2) { font-family: 'PixelFont', monospace; font-size: 14px; margin: 16px 0 8px; color: var(--color-soil); }
:deep(.tiptap-editor ul) { padding-left: 20px; }
:deep(.tiptap-editor p) { margin-bottom: 8px; }
</style>
