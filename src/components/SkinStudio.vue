<template>
  <div class="studio-body">

    <!-- ── 区域选择 ──────────────────────────────────── -->
    <div class="field-group">
      <label class="field-label">为哪个区域生成皮肤</label>
      <div class="zone-tabs">
        <button
          v-for="z in ZONES" :key="z.id"
          :class="['zone-tab', { active: targetZone === z.id }]"
          @click="targetZone = z.id; loadExisting()"
        >
          {{ z.icon }} {{ z.name }}
          <span v-if="hasSkin(z.id)" class="has-skin-dot" title="已有自定义皮肤">●</span>
        </button>
      </div>
    </div>

    <!-- ── 图像 API 配置 ─────────────────────────────── -->
    <div class="section-title">图像生成 API</div>
    <div class="provider-grid">
      <button
        v-for="p in IMG_PROVIDERS" :key="p.id"
        :class="['provider-btn', { active: imgCfg.provider === p.id }]"
        @click="selectImgProvider(p)"
      >
        {{ p.icon }} {{ p.name }}
      </button>
    </div>
    <input v-if="imgCfg.provider !== 'dalle'"
      v-model="imgCfg.apiUrl" class="pixel-input"
      :placeholder="apiUrlPlaceholder" style="margin-bottom:6px" />
    <div class="key-row">
      <input
        v-model="imgCfg.apiKey"
        :type="showKey ? 'text' : 'password'"
        class="pixel-input" placeholder="API Key…" style="flex:1"
      />
      <button class="pixel-btn" style="flex-shrink:0" @click="showKey = !showKey">
        {{ showKey ? '🙈' : '👁️' }}
      </button>
    </div>
    <input v-model="imgCfg.model" class="pixel-input"
      :placeholder="modelPlaceholder" style="margin-bottom:10px" />

    <!-- ── Prompt 工坊 ────────────────────────────────── -->
    <div class="section-title">Prompt 工坊</div>

    <div class="field-group">
      <label class="field-label">风格预设</label>
      <div class="style-grid">
        <button
          v-for="s in STYLES" :key="s.id"
          :class="['style-btn', { active: styleWord === s.id }]"
          @click="styleWord = s.id; rebuildPrompt()"
        >{{ s.icon }} {{ s.label }}</button>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">额外元素</label>
      <div class="extras-row">
        <label v-for="e in EXTRAS" :key="e.id" class="extra-check">
          <input type="checkbox" v-model="selectedExtras" :value="e.id" @change="rebuildPrompt()" />
          {{ e.label }}
        </label>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">主色调</label>
      <div class="color-row">
        <input type="color" v-model="mainColor" class="color-picker" @change="rebuildPrompt()" />
        <span class="color-hex">{{ mainColor }}</span>
        <button v-for="c in PRESET_COLORS" :key="c"
          class="color-dot" :style="{ background: c }"
          @click="mainColor = c; rebuildPrompt()" />
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">完整 Prompt（可直接编辑）</label>
      <textarea v-model="prompt" class="pixel-input prompt-ta" rows="5"
        style="resize:vertical; font-size:11px" />
    </div>

    <!-- ── 像素化参数 ──────────────────────────────────── -->
    <div class="section-title">像素化参数</div>
    <div class="proc-row">
      <label class="field-label">输出尺寸</label>
      <select v-model="procSize" class="pixel-input" style="width:90px">
        <option :value="64">64 × 64</option>
        <option :value="128">128 × 128</option>
      </select>
      <label class="field-label" style="margin-left:12px">透明阈值</label>
      <input type="range" v-model.number="alphaThreshold" min="0" max="255" step="1"
        style="flex:1" />
      <span style="font-size:11px; width:28px">{{ alphaThreshold }}</span>
    </div>

    <!-- ── 生成按钮 ────────────────────────────────────── -->
    <div class="gen-row">
      <span v-if="genStatus" :class="['gen-status', genStatusType]">{{ genStatus }}</span>
      <button class="pixel-btn pixel-btn--green gen-btn"
        :disabled="generating || !imgCfg.apiKey.trim()"
        @click="generate"
      >
        {{ generating ? `⏳ ${genProgress}` : '🎨 生成新外观' }}
      </button>
    </div>

    <!-- ── 前后对比预览 ────────────────────────────────── -->
    <div v-if="previewRaw || previewProcessed" class="preview-row">
      <div class="preview-card">
        <div class="preview-label">原始图</div>
        <img :src="previewRaw" class="preview-img" />
      </div>
      <div class="preview-arrow">→</div>
      <div class="preview-card">
        <div class="preview-label">像素化后（{{ procSize }}×{{ procSize }}）</div>
        <img :src="previewProcessed" class="preview-img pixel-render" />
      </div>
    </div>

    <!-- ── 应用 / 重置 ─────────────────────────────────── -->
    <div v-if="previewProcessed" class="apply-row">
      <button class="pixel-btn pixel-btn--danger" @click="resetCurrent">🗑️ 重置为默认</button>
      <button class="pixel-btn pixel-btn--green" @click="applySkin">✅ 应用到小屋</button>
    </div>
    <div v-else-if="hasSkin(targetZone)" class="apply-row">
      <div class="current-skin-row">
        <div class="preview-card">
          <div class="preview-label">当前自定义皮肤</div>
          <img :src="currentSkinUrl!" class="preview-img pixel-render" />
        </div>
      </div>
      <button class="pixel-btn pixel-btn--danger" @click="resetCurrent">🗑️ 恢复默认外观</button>
    </div>

    <div class="tip-box" style="margin-top:12px">
      💡 皮肤存储在本地，无需重启即可生效。「恢复默认」随时可切回内置风格。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import {
  generateSkin, getSkin, setSkin, resetSkin, resetAllSkins, getAllSkins
} from '@/utils/SkinManager'
import type { ZoneId, ImageApiConfig } from '@/utils/SkinManager'

const appStore = useAppStore()

const ZONES = [
  { id: 'garden' as ZoneId, name: '花园', icon: '🌿' },
  { id: 'study'  as ZoneId, name: '书房', icon: '📚' },
  { id: 'lounge' as ZoneId, name: '客厅', icon: '🛋️' },
  { id: 'store'  as ZoneId, name: '仓库', icon: '📦' },
  { id: 'lab'    as ZoneId, name: '实验室', icon: '⚗️' },
  { id: 'cellar' as ZoneId, name: '储藏室', icon: '🏺' },
]

const IMG_PROVIDERS = [
  { id: 'dalle',     name: 'DALL-E',      icon: '🟢', defaultModel: 'dall-e-3',       urlPlaceholder: '（固定）',                          modelPlaceholder: 'dall-e-3 / dall-e-2' },
  { id: 'sdwebui',   name: 'SD WebUI',    icon: '🎨', defaultModel: '',                urlPlaceholder: 'http://localhost:7860',              modelPlaceholder: '可留空' },
  { id: 'replicate', name: 'Replicate',   icon: '🌀', defaultModel: '',                urlPlaceholder: '（固定）',                          modelPlaceholder: '模型 version hash' },
  { id: 'custom',    name: '自定义',       icon: '🔧', defaultModel: '',                urlPlaceholder: 'https://your-api.com/v1/generate',  modelPlaceholder: '模型名（可选）' },
]

const STYLES = [
  { id: 'wooden cabin',    label: '木屋',   icon: '🪵' },
  { id: 'magic mushroom',  label: '蘑菇屋', icon: '🍄' },
  { id: 'steampunk',       label: '蒸汽朋克',icon: '⚙️' },
  { id: 'oriental',        label: '东方',   icon: '🏮' },
  { id: 'crystal tower',   label: '水晶塔', icon: '💎' },
  { id: 'underwater dome',  label: '海底',  icon: '🐚' },
]

const EXTRAS = [
  { id: 'chimney',   label: '烟囱' },
  { id: 'windmill',  label: '风车' },
  { id: 'tower',     label: '塔楼' },
  { id: 'lanterns',  label: '灯笼' },
  { id: 'garden flowers', label: '花圃' },
  { id: 'moon gate', label: '月洞门' },
]

const PRESET_COLORS = ['#e8a96c', '#6ca8e8', '#6ce89a', '#e86c6c', '#c86ce8', '#e8d96c']

// ── 状态 ─────────────────────────────────────────────────
const targetZone     = ref<ZoneId>('garden')
const styleWord      = ref('wooden cabin')
const selectedExtras = ref<string[]>([])
const mainColor      = ref('#c8864a')
const prompt         = ref('')
const procSize       = ref<64 | 128>(64)
const alphaThreshold = ref(128)
const showKey        = ref(false)

const imgCfg = reactive<ImageApiConfig>({
  provider: 'dalle',
  apiKey:   '',
  apiUrl:   '',
  model:    'dall-e-3',
})

const generating     = ref(false)
const genProgress    = ref('')
const genStatus      = ref('')
const genStatusType  = ref<'ok' | 'err' | 'info'>('info')
const previewRaw       = ref<string | null>(null)
const previewProcessed = ref<string | null>(null)
const currentSkinUrl   = ref<string | null>(null)
const existingSkins    = ref<Record<string, string>>({})

// ── 初始化 ────────────────────────────────────────────────
onMounted(() => {
  existingSkins.value = getAllSkins()
  loadExisting()
  rebuildPrompt()
  // 从 store 读取已保存的 imgApiConfig
  const saved = (appStore as any).imgApiConfig
  if (saved) Object.assign(imgCfg, saved)
})

function loadExisting() {
  currentSkinUrl.value = getSkin(targetZone.value)
  previewRaw.value = null
  previewProcessed.value = null
}

function hasSkin(zone: ZoneId) {
  return !!existingSkins.value[zone]
}

// ── Prompt 构建 ───────────────────────────────────────────
function rebuildPrompt() {
  const zone   = ZONES.find(z => z.id === targetZone.value)
  const extras = selectedExtras.value.length
    ? `, ${selectedExtras.value.join(', ')}`
    : ''
  const hex = mainColor.value
  prompt.value =
    `pixel art, 16-bit style, ${procSize.value}x${procSize.value} canvas, ` +
    `a fantasy ${zone?.name ?? 'house'}, ${styleWord.value} style, ` +
    `main color ${hex}${extras}, ` +
    `clean outline, no gradient, fixed palette of 24 colors, ` +
    `front view, isolated on transparent background, no text`
}

// ── Provider 切换 ─────────────────────────────────────────
function selectImgProvider(p: typeof IMG_PROVIDERS[0]) {
  imgCfg.provider = p.id as any
  imgCfg.model    = p.defaultModel
}

const apiUrlPlaceholder  = computed(() => IMG_PROVIDERS.find(p => p.id === imgCfg.provider)?.urlPlaceholder ?? '')
const modelPlaceholder   = computed(() => IMG_PROVIDERS.find(p => p.id === imgCfg.provider)?.modelPlaceholder ?? '')

// ── 生成 ──────────────────────────────────────────────────
async function generate() {
  if (!imgCfg.apiKey.trim()) return
  generating.value   = true
  genProgress.value  = '调用 API…'
  genStatus.value    = ''
  previewRaw.value   = null
  previewProcessed.value = null

  // 保存 API 配置
  ;(appStore as any).imgApiConfig = { ...imgCfg }

  try {
    genProgress.value = imgCfg.provider === 'replicate' ? '等待 Replicate 结果（约 20-60s）…' : '生成中…'
    const { raw, processed } = await generateSkin(
      prompt.value,
      { ...imgCfg },
      { size: procSize.value, alphaThreshold: alphaThreshold.value }
    )
    previewRaw.value       = raw
    previewProcessed.value = processed
    genStatus.value     = '✅ 生成完成，请检查效果后点击「应用」'
    genStatusType.value = 'ok'
  } catch (e: any) {
    genStatus.value     = `❌ ${e.message}`
    genStatusType.value = 'err'
  }
  generating.value = false
}

// ── 应用皮肤 ──────────────────────────────────────────────
function applySkin() {
  if (!previewProcessed.value) return
  setSkin(targetZone.value, previewProcessed.value)
  existingSkins.value = getAllSkins()
  currentSkinUrl.value = previewProcessed.value
  previewRaw.value = null
  previewProcessed.value = null
  // 通知 PixelHouse 刷新皮肤
  appStore.skinVersion = (appStore.skinVersion ?? 0) + 1
  genStatus.value     = `✅ 已应用到「${ZONES.find(z => z.id === targetZone.value)?.name}」！`
  genStatusType.value = 'ok'
}

// ── 重置 ──────────────────────────────────────────────────
function resetCurrent() {
  resetSkin(targetZone.value)
  existingSkins.value = getAllSkins()
  currentSkinUrl.value = null
  previewRaw.value = null
  previewProcessed.value = null
  appStore.skinVersion = (appStore.skinVersion ?? 0) + 1
  genStatus.value     = '已恢复默认外观'
  genStatusType.value = 'info'
}
</script>

<style scoped>
.studio-body { padding: 14px; overflow-y: auto; max-height: 480px; }

.section-title {
  font-family: 'PixelFont', monospace; font-size: 10px;
  color: var(--color-panel-border);
  padding: 8px 0 4px;
  border-bottom: 1px solid rgba(139,99,64,0.2);
  margin-bottom: 8px; margin-top: 6px;
  text-transform: uppercase; letter-spacing: 1px;
}

.field-group { margin-bottom: 10px; }
.field-label { display: block; font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-panel-border); margin-bottom: 4px; }

/* ── 区域 Tab ─────────────────────────────────────── */
.zone-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.zone-tab {
  font-family: 'PixelFont', monospace; font-size: 10px;
  padding: 4px 10px; border: 2px solid rgba(139,99,64,0.25);
  background: rgba(255,255,255,0.5); cursor: pointer; border-radius: 2px;
  color: var(--color-panel-border); position: relative;
}
.zone-tab.active { background: var(--color-wood); color: #fff; border-color: var(--color-wood); }
.has-skin-dot { color: #27ae60; font-size: 8px; position: absolute; top: 2px; right: 4px; }

/* ── Provider ─────────────────────────────────────── */
.provider-grid { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.provider-btn {
  font-family: 'PixelFont', monospace; font-size: 10px;
  padding: 5px 12px; border: 2px solid rgba(139,99,64,0.25);
  background: rgba(255,255,255,0.5); cursor: pointer; border-radius: 2px;
  color: var(--color-panel-border);
}
.provider-btn.active { background: var(--color-wood); color: #fff; border-color: var(--color-wood); }

.key-row { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }

/* ── 风格 ─────────────────────────────────────────── */
.style-grid { display: flex; gap: 6px; flex-wrap: wrap; }
.style-btn {
  font-family: 'PixelFont', monospace; font-size: 10px;
  padding: 4px 10px; border: 2px solid rgba(139,99,64,0.25);
  background: rgba(255,255,255,0.5); cursor: pointer; border-radius: 2px;
  color: var(--color-panel-border);
}
.style-btn.active { background: var(--color-grass); color: #fff; border-color: var(--color-grass); }

/* ── 额外元素 ─────────────────────────────────────── */
.extras-row { display: flex; gap: 10px; flex-wrap: wrap; }
.extra-check { display: flex; gap: 4px; align-items: center; font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-panel-border); cursor: pointer; }

/* ── 颜色 ─────────────────────────────────────────── */
.color-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.color-picker { width: 36px; height: 28px; border: 2px solid var(--color-panel-border); cursor: pointer; padding: 0; }
.color-hex { font-family: monospace; font-size: 10px; color: var(--color-panel-border); }
.color-dot { width: 20px; height: 20px; border: none; cursor: pointer; border-radius: 3px; box-shadow: 1px 1px 0 rgba(0,0,0,0.2); }

.prompt-ta { width: 100%; box-sizing: border-box; }

/* ── 像素化参数 ───────────────────────────────────── */
.proc-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }

/* ── 生成按钮 ────────────────────────────────────── */
.gen-row { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 12px; }
.gen-btn { min-width: 140px; }
.gen-status { font-family: 'PixelFont', monospace; font-size: 10px; flex: 1; }
.gen-status.ok   { color: #27ae60; }
.gen-status.err  { color: #c0392b; }
.gen-status.info { color: var(--color-panel-border); }

/* ── 预览 ─────────────────────────────────────────── */
.preview-row { display: flex; gap: 12px; align-items: center; justify-content: center; margin-bottom: 10px; }
.preview-card { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.preview-label { font-family: 'PixelFont', monospace; font-size: 9px; color: var(--color-panel-border); }
.preview-img { width: 128px; height: 128px; border: 2px solid rgba(139,99,64,0.3); background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px; }
.pixel-render { image-rendering: pixelated; image-rendering: crisp-edges; }
.preview-arrow { font-size: 20px; color: var(--color-panel-border); }

/* ── 应用行 ─────────────────────────────────────── */
.apply-row { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px; align-items: center; }
.current-skin-row { flex: 1; }

.tip-box { padding: 8px 10px; background: rgba(139,99,64,0.08); border-left: 3px solid var(--color-wood); font-family: 'PixelFont', monospace; font-size: 10px; color: var(--color-panel-border); line-height: 1.7; }
</style>
