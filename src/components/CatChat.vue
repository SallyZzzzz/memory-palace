<template>
  <transition name="chat-slide">
    <div
      v-if="appStore.showCatChat"
      class="cat-chat"
      :style="panelStyle"
      ref="panelRef"
    >
      <!-- 头部（拖拽把手）-->
      <div class="chat-header" @mousedown.prevent="startDrag">
        <div class="chat-title">
          <span class="cat-avatar">🐱</span>
          <div>
            <div class="cat-name">橘猫管家</div>
            <div class="cat-model">{{ modelLabel }}</div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="hbtn" title="设置" @click.stop="appStore.showSettings = true; appStore.showCatChat = false">⚙️</button>
          <button class="hbtn" title="清空对话" @click.stop="clearChat">🗑️</button>
          <button class="hbtn" title="关闭" @click.stop="appStore.showCatChat = false">✕</button>
        </div>
      </div>

      <!-- 消息区 -->
      <div class="chat-messages" ref="msgArea">
        <div v-if="messages.length === 0" class="welcome-wrap">
          <div class="bubble bubble--cat">
            <span class="bubble-avatar">🐱</span>
            <div class="bubble-body">
              喵～ 我是你的橘猫管家！有什么需要帮忙的吗？<br/>
              <span class="muted">先在设置里配置 AI 模型才能和我对话哦～</span>
            </div>
          </div>
        </div>

        <div
          v-for="msg in messages" :key="msg.id"
          :class="['bubble', msg.role === 'user' ? 'bubble--user' : 'bubble--cat']"
        >
          <span v-if="msg.role === 'assistant'" class="bubble-avatar">🐱</span>
          <div class="bubble-body" v-html="renderMd(msg.content)" />
          <span v-if="msg.role === 'user'" class="bubble-avatar">🧑</span>
        </div>

        <div v-if="thinking" class="bubble bubble--cat">
          <span class="bubble-avatar">🐱</span>
          <div class="bubble-body typing">
            <span /><span /><span />
          </div>
        </div>
      </div>

      <!-- 快捷问题 -->
      <div v-if="messages.length === 0" class="quick-btns">
        <button v-for="q in QUICK_Q" :key="q" class="quick-btn" @click="sendQuick(q)">{{ q }}</button>
      </div>

      <!-- 输入区 -->
      <div class="chat-input-row">
        <textarea
          v-model="input"
          class="chat-input"
          placeholder="和猫管家说点什么… （Enter 发送，Shift+Enter 换行）"
          rows="2"
          @keydown.enter.prevent="onEnter"
        />
        <button class="send-btn" :disabled="sending || !input.trim()" @click="send">
          {{ sending ? '…' : '➤' }}
        </button>
      </div>

      <div v-if="!hasApiKey" class="no-key-tip">
        ⚠️ 还没配置 API Key —
        <span class="tip-link" @click="appStore.showSettings = true; appStore.showCatChat = false">去设置</span>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/app'
import { getAllEntries } from '@/db'

const appStore = useAppStore()
const msgArea  = ref<HTMLDivElement>()
const panelRef = ref<HTMLDivElement>()
const input    = ref('')
const sending  = ref(false)
const thinking = ref(false)

interface Msg { id: number; role: 'user' | 'assistant'; content: string }
const messages = ref<Msg[]>([])
let msgId = 0

const QUICK_Q = ['我今天存了什么？', '帮我总结书房的文档', '给我整理知识的建议', '花园有多少灵感卡片？']

/* ── 面板位置（拖拽）──────────────────────────────── */
const PANEL_W = 360, PANEL_H = 540
const pos = ref({ x: window.innerWidth - PANEL_W - 12, y: window.innerHeight - PANEL_H - 60 })

const panelStyle = computed(() => ({
  left:   pos.value.x + 'px',
  top:    pos.value.y + 'px',
  width:  PANEL_W + 'px',
  height: PANEL_H + 'px',
}))

let dragging = false, dragOffX = 0, dragOffY = 0

function startDrag(e: MouseEvent) {
  dragging = true
  dragOffX = e.clientX - pos.value.x
  dragOffY = e.clientY - pos.value.y
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', stopDrag)
}
function onDragMove(e: MouseEvent) {
  if (!dragging) return
  pos.value = {
    x: Math.max(0, Math.min(window.innerWidth  - PANEL_W, e.clientX - dragOffX)),
    y: Math.max(0, Math.min(window.innerHeight - PANEL_H, e.clientY - dragOffY)),
  }
}
function stopDrag() {
  dragging = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', stopDrag)
}
onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', stopDrag)
})

/* ── 计算属性 ─────────────────────────────────────── */
const hasApiKey  = computed(() => !!appStore.llmConfig.apiKey || appStore.llmConfig.provider === 'ollama')
const modelLabel = computed(() => {
  const p = appStore.llmConfig.provider, m = appStore.llmConfig.model
  return p === 'ollama' ? `Ollama · ${m}` : m || '未配置'
})

/* ── Markdown 渲染 ────────────────────────────────── */
function renderMd(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/`(.*?)`/g,       '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}

/* ── System Prompt ────────────────────────────────── */
function buildSystemPrompt(): string {
  const custom = (appStore.llmConfig as any).systemPrompt
  const base   = custom?.trim() || '你是一只住在像素小屋里的橘猫管家，聪明、有趣、偶尔傲娇，回答简洁有趣，偶尔用「喵～」结尾。'
  const entries = getAllEntries().filter(e => !e.deletedAt)
  const summary = `\n\n【小屋数据摘要】总条目：${entries.length} 条\n` +
    ['garden','study','lounge','store','lab','cellar'].map(z =>
      `- ${z}: ${entries.filter(e => e.zone === z).length} 条`
    ).join('\n')
  return base + summary
}

/* ── 发送 ─────────────────────────────────────────── */
async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  if (!hasApiKey.value) { appStore.showSettings = true; appStore.showCatChat = false; return }

  messages.value.push({ id: ++msgId, role: 'user', content: text })
  input.value = ''; sending.value = true; thinking.value = true
  await scrollBottom()

  try {
    const cfg     = appStore.llmConfig
    const baseUrl = cfg.baseUrl || getDefaultBase(cfg.provider)
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        model: cfg.model, stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...messages.value.map(m => ({ role: m.role, content: m.content })),
        ],
      }),
    })
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0,200)}`)

    thinking.value = false
    const assistantMsg: Msg = { id: ++msgId, role: 'assistant', content: '' }
    messages.value.push(assistantMsg)

    const reader = res.body!.getReader(), dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') break
        try {
          assistantMsg.content += JSON.parse(data).choices?.[0]?.delta?.content ?? ''
          messages.value = [...messages.value]
          await scrollBottom()
        } catch { /* skip */ }
      }
    }
  } catch (e: any) {
    thinking.value = false
    messages.value.push({ id: ++msgId, role: 'assistant', content: `❌ 出错：${e.message}` })
  }
  sending.value = false
  await scrollBottom()
}

function sendQuick(q: string) { input.value = q; send() }
function onEnter(e: KeyboardEvent) { if (!e.shiftKey) send() }
function clearChat() { messages.value = []; msgId = 0 }
async function scrollBottom() {
  await nextTick()
  if (msgArea.value) msgArea.value.scrollTop = msgArea.value.scrollHeight
}
function getDefaultBase(p: string): string {
  return ({ deepseek:'https://api.deepseek.com/v1', openai:'https://api.openai.com/v1',
    ollama:'http://localhost:11434/v1', moonshot:'https://api.moonshot.cn/v1',
    zhipu:'https://open.bigmodel.cn/api/paas/v4' } as any)[p] ?? 'https://api.openai.com/v1'
}
</script>

<style scoped>
/* ━━ 颜色语义 token（WCAG AAA ≥7:1）━━━━━━━━━━━━━━━━
   背景  #fdf0e0  lum ≈ 0.871
   主文字 #1a0d00  lum ≈ 0.004  → 对比 16.9:1 ✅
   次要文字 #4a3010 lum ≈ 0.048  → 对比  7.4:1 ✅
   用户气泡背景 #5a2d00 lum ≈ 0.028 白字(1.0) → 13.4:1 ✅
   猫气泡背景   #fff   lum  1.0  主文字 → 16.9:1 ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

/* ── 面板 ─────────────────────────────────────────── */
.cat-chat {
  position: fixed;
  display: flex; flex-direction: column;
  background: #fdf0e0;
  border: 3px solid #6b3e10;
  box-shadow: -5px -5px 0 rgba(0,0,0,0.25), 5px 5px 0 rgba(0,0,0,0.12);
  z-index: 1500;
  border-radius: 3px;
  overflow: hidden;

  /* ★ 全局基准：所有子元素继承，不再各自声明 */
  font-family: 'PixelFont', monospace;
  font-size: 13px;
  line-height: 1.65;
  color: #1a0d00;
}
.chat-slide-enter-active, .chat-slide-leave-active { transition: opacity .22s, transform .22s; }
.chat-slide-enter-from, .chat-slide-leave-to { opacity: 0; transform: scale(0.94) translateY(16px); }

/* ── 头部（拖拽把手）─────────────────────────────── */
.chat-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 12px;
  background: #5a2d00; color: #fff;
  border-bottom: 3px solid rgba(0,0,0,0.25);
  cursor: grab; user-select: none;
}
.chat-header:active { cursor: grabbing; }

.chat-title { display: flex; gap: 10px; align-items: center; }
.cat-avatar  { font-size: 22px; flex-shrink: 0; }  /* emoji，独立控制大小 */
.cat-name    { font-weight: bold; color: #fff; }    /* 继承 13px */
.cat-model   { font-size: 11px; color: rgba(255,255,255,0.78); margin-top: 1px; } /* 次要标注，小一号 */

.chat-header-actions { display: flex; gap: 4px; }
.hbtn {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.82);
  font-size: inherit;  /* 继承 13px */
  padding: 3px 5px; border-radius: 3px;
}
.hbtn:hover { background: rgba(255,255,255,0.18); color: #fff; }

/* ── 消息区 ──────────────────────────────────────── */
.chat-messages {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 12px;
  scroll-behavior: smooth;
}
.welcome-wrap { width: 100%; }

.bubble {
  display: flex; gap: 8px; align-items: flex-end;
  max-width: 88%;
}
.bubble--cat  { align-self: flex-start; }
.bubble--user { align-self: flex-end; flex-direction: row-reverse; }

.bubble-avatar { font-size: 20px; flex-shrink: 0; line-height: 1; }

.bubble-body {
  padding: 10px 13px;
  /* font / line-height / color 全部继承 .cat-chat 的 13px 基准，无需重复声明 */
  word-break: break-word;
  border-radius: 3px;
}
.bubble--cat  .bubble-body {
  background: #fff;
  border: 2px solid rgba(107,62,16,0.22);
  color: #1a0d00;            /* ← 主文字色：对比 16.9:1 */
}
.bubble--user .bubble-body {
  background: #5a2d00;       /* 深木棕 */
  color: #fff;               /* 白字：对比 13.4:1 */
}

.muted {
  font-size: 11px;
  color: #4a3010;            /* 次要色：对比 7.4:1 */
  display: block;
  margin-top: 4px;
}

/* 打字动画 */
.typing { display: flex; gap: 5px; align-items: center; padding: 12px 16px; }
.typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4a3010;
  animation: blink 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }

/* ── 快捷问题 ────────────────────────────────────── */
.quick-btns {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 12px 8px;
}
.quick-btn {
  font-family: 'PixelFont', monospace; font-size: 11px;
  padding: 5px 12px;
  border: 2px solid rgba(107,62,16,0.35);
  background: rgba(255,255,255,0.7);
  color: #4a3010;            /* 对比 7.4:1 */
  cursor: pointer; border-radius: 3px; transition: all .12s;
}
.quick-btn:hover {
  background: #5a2d00; color: #fff;
  border-color: #5a2d00;
}

/* ── 输入区 ──────────────────────────────────────── */
.chat-input-row {
  display: flex; gap: 8px; padding: 8px 10px;
  border-top: 2px solid rgba(107,62,16,0.22);
  background: rgba(255,255,255,0.45);
}
.chat-input {
  flex: 1; resize: none;
  background: #fff;
  border: 2px solid rgba(107,62,16,0.3);
  font-family: 'PixelFont', monospace; font-size: 13px;
  padding: 7px 10px; line-height: 1.5;
  color: #1a0d00;            /* 主文字色 */
  outline: none; border-radius: 2px;
}
.chat-input::placeholder { color: #7a5535; opacity: 1; }  /* 占位符：对比 ≥4.5:1 */
.chat-input:focus { border-color: #5a2d00; }

.send-btn {
  width: 40px; flex-shrink: 0;
  background: #5a2d00; border: none; color: #fff;
  cursor: pointer; font-size: 16px; border-radius: 2px;
  transition: opacity .15s;
}
.send-btn:disabled { opacity: 0.38; cursor: default; }
.send-btn:not(:disabled):hover { opacity: 0.82; }

/* ── 无 API Key 提示 ──────────────────────────────── */
.no-key-tip {
  padding: 5px 12px 7px;
  font-family: 'PixelFont', monospace; font-size: 11px;
  color: #8b1a00;            /* 红棕：对比 ≥7:1 on #fdf0e0 */
  text-align: center;
  border-top: 1px solid rgba(107,62,16,0.15);
}
.tip-link { cursor: pointer; text-decoration: underline; color: #5a2d00; }
</style>