<template>
  <div class="settings-overlay" @click.self="appStore.showSettings = false">
    <div class="settings-panel pixel-panel">
      <!-- 标题栏 -->
      <div class="settings-header">
        <span>⚙️ 设置</span>
        <button class="qa-close" @click="appStore.showSettings = false">✕</button>
      </div>

      <!-- Tab -->
      <div class="settings-tabs">
        <button :class="['stab', { active: tab === 'llm' }]"  @click="tab = 'llm'">🤖 AI 助手</button>
        <button :class="['stab', { active: tab === 'sync' }]" @click="tab = 'sync'">☁️ 云同步</button>
        <button :class="['stab', { active: tab === 'skin' }]" @click="tab = 'skin'">🎨 外观生成</button>
      </div>

      <!-- ── Tab: LLM ──────────────────────────────── -->
      <div v-if="tab === 'llm'" class="tab-body">
        <div class="field-group">
          <label class="field-label">AI 提供商</label>
          <div class="provider-grid">
            <button
              v-for="p in PROVIDERS" :key="p.id"
              :class="['provider-btn', { active: lc.provider === p.id }]"
              @click="selectProvider(p)"
            >
              <span class="provider-icon">{{ p.icon }}</span>
              <span>{{ p.name }}</span>
            </button>
          </div>
        </div>

        <div v-if="lc.provider === 'custom'" class="field-group">
          <label class="field-label">Base URL（OpenAI 兼容接口）</label>
          <input v-model="lc.baseUrl" class="pixel-input" placeholder="https://your-api.com/v1" />
        </div>

        <div class="field-group">
          <label class="field-label">API Key</label>
          <div class="key-row">
            <input
              v-model="lc.apiKey"
              :type="showKey ? 'text' : 'password'"
              class="pixel-input"
              placeholder="sk-..."
              style="flex:1"
            />
            <button class="pixel-btn" style="flex-shrink:0" @click="showKey = !showKey">
              {{ showKey ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">模型</label>
          <div class="model-row">
            <select v-model="lc.model" class="pixel-input" style="flex:1">
              <option v-for="m in currentModels" :key="m" :value="m">{{ m }}</option>
              <option value="__custom__">自定义…</option>
            </select>
            <input
              v-if="lc.model === '__custom__'"
              v-model="customModel"
              class="pixel-input"
              placeholder="输入模型名"
              style="flex:1; margin-left:6px"
            />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">猫咪人设（可选）</label>
          <textarea
            v-model="lc.systemPrompt"
            class="pixel-input"
            rows="3"
            style="resize:vertical"
            placeholder="你是一只住在像素小屋里的橘猫管家，聪明、有趣、偶尔傲娇…"
          />
        </div>

        <div class="save-row">
          <span v-if="llmSaved" class="save-ok">✅ 已保存</span>
          <button class="pixel-btn pixel-btn--green" @click="saveLlm">💾 保存 AI 设置</button>
        </div>

        <div class="tip-box">
          💡 推荐使用 <strong>DeepSeek</strong>（速度快、价格低）或 <strong>Ollama</strong>（本地运行、完全免费）
        </div>
      </div>

      <!-- ── Tab: 云同步 ────────────────────────────── -->
      <div v-if="tab === 'sync'" class="tab-body">
        <div class="field-group">
          <label class="field-label">同步方式</label>
          <div class="provider-grid">
            <button
              v-for="s in SYNC_TYPES" :key="s.id"
              :class="['provider-btn', { active: sc.type === s.id }]"
              @click="sc.type = s.id"
            >
              <span class="provider-icon">{{ s.icon }}</span>
              <span>{{ s.name }}</span>
            </button>
          </div>
        </div>

        <template v-if="sc.type === 'webdav'">
          <div class="field-group">
            <label class="field-label">WebDAV 地址</label>
            <input v-model="sc.url" class="pixel-input" placeholder="https://dav.jianguoyun.com/dav/像素小屋/" />
          </div>
          <div class="field-group">
            <label class="field-label">用户名</label>
            <input v-model="sc.username" class="pixel-input" placeholder="账号邮箱" />
          </div>
          <div class="field-group">
            <label class="field-label">密码 / 应用密码</label>
            <input v-model="sc.password" type="password" class="pixel-input" placeholder="••••••••" />
          </div>
        </template>

        <div v-if="sc.type === 'export'" class="tip-box" style="margin-top:8px">
          📦 手动导出 / 导入 JSON 文件，在另一台设备上恢复数据。
        </div>

        <div class="sync-action-row">
          <span v-if="syncStatus" :class="['sync-status', syncStatusType]">{{ syncStatus }}</span>
          <template v-if="sc.type === 'webdav'">
            <button class="pixel-btn" @click="syncPull" :disabled="syncing">⬇️ 从云端拉取</button>
            <button class="pixel-btn pixel-btn--green" @click="syncPush" :disabled="syncing">
              {{ syncing ? '同步中…' : '⬆️ 推送到云端' }}
            </button>
          </template>
          <template v-else>
            <button class="pixel-btn" @click="importJson">📂 导入 JSON</button>
            <button class="pixel-btn pixel-btn--green" @click="exportJson">⬇️ 导出 JSON</button>
          </template>
        </div>

        <div class="save-row" style="margin-top:8px">
          <span v-if="syncSaved" class="save-ok">✅ 配置已保存</span>
          <button class="pixel-btn pixel-btn--green" @click="saveSync">💾 保存同步设置</button>
        </div>

        <div class="tip-box">
          💡 推荐使用<strong>坚果云</strong>的 WebDAV（免费），或自建 Nextcloud。
          坚果云需在「账户信息 → 安全选项」生成<strong>应用密码</strong>。
        </div>
      </div>

      <!-- ── Tab: 外观生成 ──────────────────────────── -->
      <SkinStudio v-if="tab === 'skin'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useAppStore } from '@/store/app'
import { getAllEntries } from '@/db'
import { open as tauriOpen, save as tauriSave } from '@tauri-apps/plugin-dialog'
import SkinStudio from '@/components/SkinStudio.vue'

const appStore = useAppStore()
const tab = ref<'llm' | 'sync' | 'skin'>('llm')

/* ── LLM 设置 ──────────────────────────────────────── */
const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', icon: '🌊', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'openai',   name: 'OpenAI',   icon: '🟢', baseUrl: 'https://api.openai.com/v1',   models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'ollama',   name: 'Ollama',   icon: '🦙', baseUrl: 'http://localhost:11434/v1',   models: ['llama3', 'qwen2.5', 'mistral', 'phi3', 'gemma2'] },
  { id: 'moonshot', name: '月之暗面', icon: '🌙', baseUrl: 'https://api.moonshot.cn/v1',  models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'zhipu',    name: '智谱 GLM', icon: '🧠', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4', 'glm-4-long'] },
  { id: 'custom',   name: '自定义',   icon: '🔧', baseUrl: '',                             models: [] },
]

// 本地副本，避免直接改 store（点保存才写入）
const lc = reactive({
  provider:     appStore.llmConfig.provider,
  apiKey:       appStore.llmConfig.apiKey,
  model:        appStore.llmConfig.model,
  baseUrl:      appStore.llmConfig.baseUrl,
  systemPrompt: (appStore.llmConfig as any).systemPrompt ?? '',
})
const showKey     = ref(false)
const customModel = ref('')
const llmSaved    = ref(false)

const currentProvider = computed(() => PROVIDERS.find(p => p.id === lc.provider))
const currentModels   = computed(() => currentProvider.value?.models ?? [])

function selectProvider(p: typeof PROVIDERS[0]) {
  lc.provider = p.id
  lc.baseUrl  = p.baseUrl
  if (p.models.length > 0) lc.model = p.models[0]
}

function saveLlm() {
  const model = lc.model === '__custom__' ? customModel.value.trim() || 'gpt-4o' : lc.model
  Object.assign(appStore.llmConfig, { ...lc, model })
  appStore.saveLlmConfig()
  llmSaved.value = true
  setTimeout(() => { llmSaved.value = false }, 2000)
}

/* ── 云同步设置 ─────────────────────────────────────── */
const SYNC_TYPES = [
  { id: 'webdav', name: 'WebDAV', icon: '📡' },
  { id: 'export', name: '手动导入/导出', icon: '📦' },
]
const sc = reactive({
  type:     appStore.syncConfig.type,
  url:      appStore.syncConfig.url,
  username: appStore.syncConfig.username,
  password: appStore.syncConfig.password,
})
const syncStatus     = ref('')
const syncStatusType = ref<'ok' | 'err' | 'info'>('info')
const syncing        = ref(false)
const syncSaved      = ref(false)

function setSyncStatus(msg: string, type: 'ok' | 'err' | 'info' = 'info') {
  syncStatus.value     = msg
  syncStatusType.value = type
  setTimeout(() => { syncStatus.value = '' }, 4000)
}

function saveSync() {
  Object.assign(appStore.syncConfig, sc)
  appStore.saveSyncConfig()
  syncSaved.value = true
  setTimeout(() => { syncSaved.value = false }, 2000)
}

/* WebDAV helpers */
function webdavHeaders() {
  const cred = btoa(`${sc.username}:${sc.password}`)
  return { 'Authorization': `Basic ${cred}`, 'Content-Type': 'application/json' }
}
const WEBDAV_FILE = 'pixelhouse_data.json'
function webdavUrl() {
  return sc.url.endsWith('/') ? `${sc.url}${WEBDAV_FILE}` : `${sc.url}/${WEBDAV_FILE}`
}

async function syncPush() {
  if (!sc.url || !sc.username) { setSyncStatus('请先填写 WebDAV 地址和账号', 'err'); return }
  syncing.value = true
  try {
    const payload = JSON.stringify({ entries: getAllEntries(), ts: Date.now() })
    const res = await fetch(webdavUrl(), { method: 'PUT', headers: webdavHeaders(), body: payload })
    if (res.ok || res.status === 201) {
      setSyncStatus('✅ 推送成功！', 'ok')
    } else {
      setSyncStatus(`❌ 推送失败：${res.status} ${res.statusText}`, 'err')
    }
  } catch (e: any) {
    setSyncStatus(`❌ 网络错误：${e.message}`, 'err')
  }
  syncing.value = false
}

async function syncPull() {
  if (!sc.url || !sc.username) { setSyncStatus('请先填写 WebDAV 地址和账号', 'err'); return }
  syncing.value = true
  try {
    const res = await fetch(webdavUrl(), { method: 'GET', headers: webdavHeaders() })
    if (!res.ok) { setSyncStatus(`❌ 拉取失败：${res.status}`, 'err'); syncing.value = false; return }
    const data = await res.json()
    if (!Array.isArray(data.entries)) { setSyncStatus('❌ 云端数据格式不正确', 'err'); syncing.value = false; return }
    // 合并：以 id 为键，云端优先
    const local = getAllEntries()
    const localMap = Object.fromEntries(local.map(e => [e.id, e]))
    data.entries.forEach((e: any) => { localMap[e.id] = e })
    localStorage.setItem('ph_entries', JSON.stringify(Object.values(localMap)))
    setSyncStatus(`✅ 已从云端拉取并合并 ${data.entries.length} 条数据！`, 'ok')
  } catch (e: any) {
    setSyncStatus(`❌ 网络错误：${e.message}`, 'err')
  }
  syncing.value = false
}

/* 手动导入/导出 */
async function exportJson() {
  try {
    const path = await tauriSave({
      defaultPath: 'pixelhouse_backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    const data = JSON.stringify({ entries: getAllEntries(), ts: Date.now() }, null, 2)
    // 使用 Tauri fs 写文件（writeTextFile 需要 fs 插件，此处用 Blob + anchor 方案）
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'pixelhouse_backup.json'; a.click()
    URL.revokeObjectURL(url)
    setSyncStatus('✅ 导出成功！', 'ok')
  } catch { setSyncStatus('导出已取消', 'info') }
}

async function importJson() {
  try {
    const path = await tauriOpen({ filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!path) return
    setSyncStatus('请将 JSON 文件内容粘贴到浏览器控制台导入（暂不支持自动导入）', 'info')
  } catch { }
}
</script>

<style scoped>
.settings-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.settings-panel {
  width: 520px; max-height: 80vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.settings-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: var(--color-wood); color: #fff;
  font-family: 'PixelFont', monospace; font-size: 13px; border-bottom: 3px solid rgba(0,0,0,0.2);
}
.qa-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.8); font-size: 16px; }
.qa-close:hover { color: #fff; }

.settings-tabs {
  display: flex; border-bottom: 3px solid rgba(139,99,64,0.2);
}
.stab {
  flex: 1; padding: 8px; background: rgba(0,0,0,0.03);
  border: none; cursor: pointer;
  font-family: 'PixelFont', monospace; font-size: 11px;
  color: var(--color-panel-border); transition: background 0.15s;
  border-bottom: 3px solid transparent; margin-bottom: -3px;
}
.stab.active { background: #fff; color: var(--color-wood); border-bottom-color: var(--color-wood); }

.tab-body { padding: 16px; overflow-y: auto; flex: 1; }

.field-group { margin-bottom: 14px; }
.field-label { display: block; font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-panel-border); margin-bottom: 6px; }

.provider-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.provider-btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 8px 12px; border: 2px solid rgba(139,99,64,0.25);
  background: rgba(255,255,255,0.6); cursor: pointer; border-radius: 4px;
  font-family: 'PixelFont', monospace; font-size: 9px;
  color: var(--color-panel-border); transition: all 0.15s;
}
.provider-btn.active { border-color: var(--color-wood); background: var(--color-wood); color: #fff; }
.provider-btn:hover:not(.active) { border-color: var(--color-wood); }
.provider-icon { font-size: 18px; }

.key-row, .model-row { display: flex; gap: 8px; align-items: center; }

.save-row { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 4px; }
.save-ok { font-family: 'PixelFont', monospace; font-size: 10px; color: #27ae60; }

.sync-action-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px;
}
.sync-status { font-family: 'PixelFont', monospace; font-size: 10px; flex: 1; }
.sync-status.ok   { color: #27ae60; }
.sync-status.err  { color: #c0392b; }
.sync-status.info { color: var(--color-panel-border); }

.tip-box {
  margin-top: 12px; padding: 10px 12px;
  background: rgba(139,99,64,0.08); border-left: 3px solid var(--color-wood);
  font-family: 'PixelFont', monospace; font-size: 10px; line-height: 1.7;
  color: var(--color-panel-border);
}
</style>
