<template>
  <div class="strip-pet" :style="stripStyle">
    <div class="bg-layers" @mousedown="startDragStrip" @wheel.prevent="onWheel">
      <canvas ref="canvasRef" class="ground-canvas" />
    </div>
    <div class="zones-overlay" @dblclick="openMain" @contextmenu.prevent="showMenu" @wheel.prevent="onWheel">
      <div v-for="zone in ZONES" :key="zone.id" class="zone-hit" :style="zoneHitStyle(zone)"
        :class="{ 'zone-active': dragOverZone === zone.id }"
        @click.stop="openZone(zone.id)"
        @dragover.prevent="dragOverZone = zone.id"
        @dragleave="dragOverZone = null"
        @drop.prevent="onZoneDrop($event, zone.id)">
        <div class="zone-tip">
          <span>{{ zone.icon }}</span>
          <span class="zone-tip-name">{{ zone.name }}</span>
        </div>
        <div v-if="dragOverZone === zone.id" class="zone-drop-hint">📂 放入{{ zone.name }}</div>
      </div>
    </div>
    <!-- 猫咪热区（点击唤起 AI 聊天）-->
    <div
      class="cat-hotzone"
      :style="catHotzoneStyle"
      @click.stop="appStore.showCatChat = !appStore.showCatChat"
      title="和猫管家聊天 🐱"
    />

    <!-- 显眼拉伸按钮 -->
    <div class="resize-handle" @mousedown.stop="startResize">
      <div class="resize-inner">
        <span class="resize-arrow">◀</span>
        <span class="resize-label">拖拽</span>
        <span class="resize-arrow">▶</span>
      </div>
    </div>
    <!-- 存入反馈气泡 -->
    <Transition name="bubble-fade">
      <div v-if="feedbackVisible" class="feedback-bubble" :style="feedbackStyle">
        {{ feedbackMsg }}
      </div>
    </Transition>
    <!-- 缩放指示器 -->
    <Transition name="bubble-fade">
      <div v-if="scaleHintVisible" class="scale-hint">
        🔍 {{ Math.round(scale * 100) }}%
      </div>
    </Transition>
    <div v-if="levelUpVisible" class="level-bubble">🎉 {{ appStore.currentLevel.name }}</div>
    <Teleport to="body">
      <template v-if="menuVisible">
        <div class="ctx-overlay" @click.stop="menuVisible = false"></div>
        <div class="ctx-menu" :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }">
          <div class="ctx-title">🏰 像素小屋</div>
          <hr class="ctx-hr" />
          <button class="ctx-item" @click="triggerQuickAdd">✏️ 快速记录</button>
          <button class="ctx-item" @click="menuVisible = false; appStore.showCatChat = !appStore.showCatChat">🐱 和猫管家聊天</button>
          <button class="ctx-item" @click="menuVisible = false; appStore.showSettings = true">⚙️ 设置</button>
          <hr class="ctx-hr" />
          <!-- 缩放控制条 -->
          <div class="ctx-scale-row">
            <button class="ctx-scale-btn" @click.stop="changeScale(-0.1)">－</button>
            <span class="ctx-scale-val">{{ Math.round(scale * 100) }}%</span>
            <button class="ctx-scale-btn" @click.stop="changeScale(0.1)">＋</button>
          </div>
          <hr class="ctx-hr" />
          <button v-for="z in ZONES" :key="z.id" class="ctx-item" @click="openZone(z.id)">
            {{ z.icon }} 进入{{ z.name }}
          </button>
          <hr class="ctx-hr" />
          <button class="ctx-item ctx-danger" @click="exitApp">✖ 退出</button>
        </div>
      </template>
      <template v-if="qaVisible">
        <div class="qa-overlay" @click.self="qaVisible = false">
          <div ref="qaBoxRef" class="qa-box" :style="qaBoxStyle">
            <div class="qa-head">✏️ 快速记录 <button class="qa-x" @click="qaVisible = false">✕</button></div>
            <input ref="qaInputRef" v-model="qaTitle" class="qa-input" placeholder="标题（可选）"
              @keydown.enter="qaBodyRef && qaBodyRef.focus()" />
            <textarea ref="qaBodyRef" v-model="qaBody" class="qa-input qa-ta" rows="4"
              placeholder="写下你的想法…" @keydown.ctrl.enter="submitQA"></textarea>
            <div class="qa-zones">
              <button v-for="z in ZONES" :key="z.id" class="qz-btn"
                :class="{ active: qaZone === z.id }" @click="qaZone = z.id">
                {{ z.icon }} {{ z.name }}
              </button>
            </div>
            <div class="qa-drop" :class="{ active: qaFileHover }"
              @dragover.prevent="qaFileHover = true" @dragleave="qaFileHover = false"
              @drop.prevent="onQAFileDrop">
              <span v-if="!qaFiles.length">📎 拖放文件，或
                <span class="link" @click="fileInputRef && fileInputRef.click()">点击选择</span>
              </span>
              <div v-else class="qa-file-list">
                <span v-for="f in qaFiles" :key="f.name" class="qa-chip">📄 {{ f.name }}</span>
              </div>
            </div>
            <input ref="fileInputRef" type="file" multiple style="display:none" @change="onFileSelect" />
            <div class="qa-actions">
              <button class="qa-save" @click="submitQA">💾 保存 <kbd>Ctrl+↵</kbd></button>
            </div>
          </div>
        </div>
      </template>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppStore } from '@/store/app'
import { createEntry } from '@/db'
import type { ZoneId } from '@/db/types'

// 4个城堡庭院背景（轮流分配给 6 个区域）
import _bg1 from '@/assets/bg/PNG/background 1/background 1.png'
import _bg2 from '@/assets/bg/PNG/background 2/background 2.png'
import _bg3 from '@/assets/bg/PNG/background 3/background 3.png'
import _bg4 from '@/assets/bg/PNG/background 4/background 4.png'
// 地板：summer 2 的草地层（透明背景，只有底部绿草）
import _groundSrc from '@/assets/bg/PNG/summer 2/3.png'
// 猫咪待机精灵图（固定位置，不游走）
import _catIdleSrc from '@/assets/bg/3 Cat/Idle.png'

const appStore = useAppStore()

// ── 常量 ──────────────────────────────────────────────
const ZONE_COUNT      = 6
const STRIP_H         = 160
const MIN_W           = 400
const GRASS_H         = 0     // 草地高度由图片决定，不再手动设定
const CAT_IDLE_FRAMES = 4     // Idle.png 帧数
const CAT_IDLE_FPS    = 6     // 待机动画帧率

// ── 尺寸 ──────────────────────────────────────────────
const stripW = ref(window.innerWidth)
const stripX = ref(0)
const stripY = ref(window.innerHeight - STRIP_H - 4)

// ── 区域 ──────────────────────────────────────────────
const ZONES = [
  { id: 'garden' as ZoneId, icon: '🌱', name: '花园',   idx: 0 },
  { id: 'study'  as ZoneId, icon: '📚', name: '书房',   idx: 1 },
  { id: 'lounge' as ZoneId, icon: '🎨', name: '客厅',   idx: 2 },
  { id: 'lab'    as ZoneId, icon: '🔬', name: '实验室', idx: 3 },
  { id: 'store'  as ZoneId, icon: '📦', name: '仓库',   idx: 4 },
  { id: 'cellar' as ZoneId, icon: '🗝️', name: '地窖',  idx: 5 },
]
// 6 个区域对应背景（4 个背景循环分配）
const ZONE_BG_SRCS = [_bg1, _bg2, _bg3, _bg4, _bg1, _bg2]

const zoneUnitW = computed(() => stripW.value / ZONE_COUNT)
function zoneHitStyle(z: typeof ZONES[0]) {
  // 用 floor(right) - floor(left) 消除相邻区域之间的 1px 缝隙
  const left  = Math.floor(z.idx * zoneUnitW.value)
  const right = Math.floor((z.idx + 1) * zoneUnitW.value)
  return { left: left + 'px', width: (right - left) + 'px', top: '0', height: '100%' }
}
// ── 缩放 ──────────────────────────────────────────────
const scale          = ref(1.0)
const scaleHintVisible = ref(false)
let scaleTimer = 0

function changeScale(delta: number) {
  scale.value = Math.round(Math.max(0.4, Math.min(2.5, scale.value + delta)) * 100) / 100
  scaleHintVisible.value = true
  clearTimeout(scaleTimer)
  scaleTimer = window.setTimeout(() => { scaleHintVisible.value = false }, 1400)
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  changeScale(e.deltaY < 0 ? 0.05 : -0.05)
}

const stripStyle = computed(() => ({
  left:            stripX.value + 'px',
  top:             stripY.value + 'px',
  width:           stripW.value + 'px',
  height:          STRIP_H + 'px',
  transform:       `scale(${scale.value})`,
  transformOrigin: '0 100%',   // 从左下角等比缩放，底边不动
}))

// ── 图片加载 ──────────────────────────────────────────
function loadImg(src: string) { const i = new Image(); i.src = src; return i }
const zoneBgImgs  = ZONE_BG_SRCS.map(loadImg)
const groundImg   = loadImg(_groundSrc)
const catIdleImg  = loadImg(_catIdleSrc)

// ── Canvas ────────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId = 0, fc = 0

/**
 * 绘制单个区域背景：按【宽度】缩放填满区域，底部对齐，超高裁顶
 * 这样每个区域横向完全填满，绝无缝隙
 */
function drawBuilding(ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  zoneIdx: number, zoneCount: number, W: number, maxH: number) {
  if (!img.complete || !img.naturalWidth) return
  const zw     = W / zoneCount
  const bx     = Math.floor(zoneIdx * zw)
  const bxNext = Math.floor((zoneIdx + 1) * zw)
  const bw     = bxNext - bx          // 精确区域宽（无缝）
  ctx.save()
  // 裁剪到当前区域（+1 消除亚像素缝）
  ctx.beginPath(); ctx.rect(bx, 0, bw + 1, maxH); ctx.clip()
  // 按宽度缩放，保证横向完全填满
  const scale  = bw / img.naturalWidth
  const scaledH = img.naturalHeight * scale
  // 底部对齐（超高则裁顶部，留底部建筑/地面）
  const dy = maxH - scaledH
  ctx.drawImage(img, bx, dy, bw, scaledH)
  ctx.restore()
}

/**
 * 绘制地板：使用 summer 2/3.png（草地层）横向平铺
 * 图片底部是草地，上方透明 → 底部对齐后只显示草地部分
 */
function drawGround(ctx: CanvasRenderingContext2D, W: number, H: number) {
  if (!groundImg.complete || !groundImg.naturalWidth) {
    // 降级纯色草地
    ctx.fillStyle = '#5aaa3a'; ctx.fillRect(0, H - 24, W, 24)
    return
  }
  // 按高度缩放，底部对齐，横向平铺
  const scale   = H / groundImg.naturalHeight
  const tileW   = groundImg.naturalWidth * scale
  for (let x = 0; x <= W; x += tileW) {
    ctx.drawImage(groundImg, x, 0, tileW, H)
  }
}

function draw() {
  const canvas = canvasRef.value; if (!canvas) return
  const W = stripW.value, H = STRIP_H, dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
  }
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = false

  const ZW = zoneUnitW.value

  // ① 各区城堡背景（无缝拼接）
  ZONES.forEach(zone => {
    const bx = Math.floor(zone.idx * ZW)
    const bw = Math.floor((zone.idx + 1) * ZW) - bx
    if (dragOverZone.value === zone.id) {
      ctx.fillStyle = 'rgba(255,220,80,0.20)'; ctx.fillRect(bx, 0, bw, H)
    }
    // 优先使用玩家自定义皮肤；image-rendering: pixelated 已由 CSS 保证
    const customImg = customSkinImgs.value[zone.id]
    const buildImg  = (customImg?.complete && customImg.naturalWidth > 0)
      ? customImg
      : zoneBgImgs[zone.idx]
    if (buildImg) drawBuilding(ctx, buildImg, zone.idx, ZONE_COUNT, W, H)
  })

  // ② 统一地板（summer 2/3.png 草地层，横向平铺，覆盖所有区域底部）
  drawGround(ctx, W, H)

  // ③ 无区域分隔线（不要缝隙）

  // ④ 猫咪待机（固定在第 1 区中央，站在草地上）
  if (catIdleImg.complete && catIdleImg.naturalWidth > 0) {
    const frameW   = catIdleImg.naturalWidth / CAT_IDLE_FRAMES
    const frameH   = catIdleImg.naturalHeight
    const catH     = 44
    const catW     = frameW * (catH / frameH)
    const catFrame = Math.floor(fc / (60 / CAT_IDLE_FPS)) % CAT_IDLE_FRAMES
    const catX = Math.round(0.5 * ZW - catW / 2)
    // 草地图片底部对齐 H，草尖约在 H*0.55 附近 → 猫站在 H*0.52
    const catY = Math.round(H * 0.52) - catH

    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(catIdleImg, catFrame * frameW, 0, frameW, frameH, catX, catY, catW, catH)
    // 猫阴影（落在草地面上）
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(catX + catW / 2, Math.round(H * 0.52) + 2, catW * 0.4, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
  fc++
  animId = requestAnimationFrame(draw)
}

// ── 拖拽条 ────────────────────────────────────────────
let draggingStrip = false, dragStartX = 0, dragStartY = 0, dragStartSX = 0, dragStartSY = 0
function startDragStrip(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('resize-handle')) return
  draggingStrip = true; dragStartX = e.clientX; dragStartY = e.clientY
  dragStartSX = stripX.value; dragStartSY = stripY.value
  window.addEventListener('mousemove', onDragStrip); window.addEventListener('mouseup', stopDragStrip)
}
function onDragStrip(e: MouseEvent) {
  if (!draggingStrip) return
  stripX.value = dragStartSX + (e.clientX - dragStartX)
  stripY.value = dragStartSY + (e.clientY - dragStartY)
}
function stopDragStrip() {
  draggingStrip = false
  window.removeEventListener('mousemove', onDragStrip); window.removeEventListener('mouseup', stopDragStrip)
}

// ── 调节宽度 ──────────────────────────────────────────
let resizing = false, resizeStartX = 0, resizeStartW = 0
function startResize(e: MouseEvent) {
  resizing = true; resizeStartX = e.clientX; resizeStartW = stripW.value
  window.addEventListener('mousemove', onResize); window.addEventListener('mouseup', stopResize)
}
function onResize(e: MouseEvent) {
  if (!resizing) return
  stripW.value = Math.max(MIN_W, Math.min(window.innerWidth - stripX.value, resizeStartW + (e.clientX - resizeStartX)))
}
function stopResize() {
  resizing = false
  window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize)
}

// ── 拖放文件 ──────────────────────────────────────────
const dragOverZone = ref<ZoneId | null>(null)
function onZoneDrop(e: DragEvent, zoneId: ZoneId) {
  dragOverZone.value = null
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) {
    files.forEach(f => {
      createEntry({ zone: zoneId, title: f.name, content: '', entryType: 'resource', tags: [], meta: { filePath: f.name, fileSize: f.size } })
    })
    appStore.refreshStats()
    const zone = ZONES.find(z => z.id === zoneId)
    showFeedback(`${zone?.icon ?? '📦'} 已存入${zone?.name ?? '区域'}！`, e.clientX, e.clientY)
    showLevelUp()
  }
}

// ── 反馈气泡 ──────────────────────────────────────────
const feedbackVisible = ref(false)
const feedbackMsg     = ref('')
const feedbackX       = ref(0)
const feedbackY       = ref(0)
const feedbackStyle   = computed(() => ({
  left: Math.min(feedbackX.value, stripW.value - 160) + 'px',
  top:  '-46px',
}))
let feedbackTimer = 0
function showFeedback(msg: string, clientX: number, clientY: number) {
  // 将屏幕坐标转换为条形相对坐标
  feedbackX.value   = clientX - stripX.value
  feedbackY.value   = clientY - stripY.value
  feedbackMsg.value = msg
  feedbackVisible.value = true
  clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedbackVisible.value = false }, 2200)
}

// ── 导航（直接操作 appStore，不依赖父组件监听 emit）────────
function openMain() {
  menuVisible.value = false
  appStore.activeZone = null
  appStore.isMainWindowOpen = true
}
function openZone(id: ZoneId) {
  menuVisible.value = false
  appStore.activeZone = id
  appStore.isMainWindowOpen = true
}

// ── 猫咪热区（花园区中心，与 canvas 中猫咪位置对应）──────
const catHotzoneStyle = computed((): CSSProperties => {
  const ZW = Math.floor(stripW.value / ZONES.length)
  const catW = Math.round(ZW * 0.28)
  const catH = Math.round(catW * 1.2)
  const catX = Math.round(ZW * 0.5 - catW / 2)
  const catY = Math.round(STRIP_H * 0.18)
  return {
    position: 'absolute',
    left:   `${catX}px`,
    bottom: `${STRIP_H - catY - catH}px`,
    width:  `${catW}px`,
    height: `${catH}px`,
    cursor: 'pointer',
    zIndex: 20,
  }
})

// ── 右键菜单（右上角定位，边界保护）─────────────────────
const menuVisible = ref(false), menuPos = ref({ x: 0, y: 0 })
const MENU_W = 210   // 菜单估算宽度
const MENU_H = 380   // 菜单估算高度（含缩放条 + 6区域按钮）
function showMenu(e: MouseEvent) {
  // 默认出现在鼠标右上角（向右偏移 6px，向上偏移菜单高度）
  const x = Math.min(e.clientX + 6, window.innerWidth  - MENU_W - 8)
  const y = Math.max(e.clientY - MENU_H, 8)
  menuPos.value = { x, y }
  menuVisible.value = true
}
function exitApp() { menuVisible.value = false; (window as any).__TAURI__?.process?.exit(0) }

// ── 快速记录 ──────────────────────────────────────────
const qaVisible   = ref(false)
const qaTitle     = ref(''), qaBody = ref(''), qaZone = ref<ZoneId>('lounge')
const qaFiles     = ref<File[]>([]), qaFileHover = ref(false)
const qaInputRef  = ref<HTMLInputElement | null>(null)
const qaBodyRef   = ref<HTMLTextAreaElement | null>(null)
const qaBoxRef    = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const qaBoxStyle  = computed(() => ({ bottom: (STRIP_H + 16) + 'px', right: '24px' }))

function triggerQuickAdd() {
  menuVisible.value = false; qaTitle.value = ''; qaBody.value = ''; qaFiles.value = []; qaZone.value = 'lounge'
  qaVisible.value = true; nextTick(() => qaInputRef.value?.focus())
}
async function submitQA() {
  if (!qaTitle.value.trim() && !qaBody.value.trim() && !qaFiles.value.length) return
  await createEntry({ zone: qaZone.value, title: qaTitle.value.trim() || '快速记录', content: qaBody.value.trim(), entryType: 'idea', tags: [], meta: {} })
  qaVisible.value = false; showLevelUp()
}
function onQAFileDrop(e: DragEvent) {
  qaFileHover.value = false; qaFiles.value = [...qaFiles.value, ...Array.from(e.dataTransfer?.files ?? [])]
}
function onFileSelect(e: Event) {
  const t = e.target as HTMLInputElement; if (t.files) qaFiles.value = [...qaFiles.value, ...Array.from(t.files)]
}

// ── 升级气泡 ──────────────────────────────────────────
const levelUpVisible = ref(false)
function showLevelUp() { levelUpVisible.value = true; setTimeout(() => { levelUpVisible.value = false }, 2500) }

// ── ESC 关闭 ──────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { menuVisible.value = false; qaVisible.value = false }
}

// ── 自定义皮肤支持 ──────────────────────────────────────
import { watch } from 'vue'
import { getSkin } from '@/utils/SkinManager'
import type { CSSProperties } from 'vue'

// 自定义皮肤 Image 映射（zone.id → HTMLImageElement | null）
const customSkinImgs = ref<Record<string, HTMLImageElement | null>>({})

function loadCustomSkins() {
  ZONES.forEach(z => {
    const data = getSkin(z.id as any)
    if (data) {
      const img = new Image()
      img.src = data
      img.onload = () => {
        customSkinImgs.value = { ...customSkinImgs.value, [z.id]: img }
      }
    } else {
      customSkinImgs.value = { ...customSkinImgs.value, [z.id]: null }
    }
  })
}

// 皮肤变化时（apply/reset）自动重载
watch(() => appStore.skinVersion, loadCustomSkins)

// ── 生命周期 ──────────────────────────────────────────
onMounted(() => {
  loadCustomSkins()
  stripW.value = window.innerWidth; stripX.value = 0
  stripY.value = window.innerHeight - STRIP_H - 4
  nextTick(() => { animId = requestAnimationFrame(draw) })
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', () => {
    stripW.value = window.innerWidth; stripX.value = 0
    stripY.value = window.innerHeight - STRIP_H - 4
  })
})
onUnmounted(() => {
  cancelAnimationFrame(animId); document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousemove', onDragStrip); window.removeEventListener('mouseup', stopDragStrip)
  window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize)
  clearTimeout(feedbackTimer); clearTimeout(scaleTimer)
})
</script>
<style scoped>
.strip-pet { position:fixed; z-index:9999; user-select:none; pointer-events:none; }
.bg-layers { position:absolute; inset:0; pointer-events:auto; cursor:grab; }
.bg-layers:active { cursor:grabbing; }
.ground-canvas { position:absolute; inset:0; image-rendering:pixelated; }
.zones-overlay { position:absolute; inset:0; pointer-events:auto; }
.zone-hit { position:absolute; cursor:pointer; transition:background 0.15s; border-radius:4px; }
.zone-hit:hover { background:rgba(255,255,255,0.07); }
.zone-hit.zone-active { background:rgba(255,220,80,0.20); box-shadow:inset 0 0 0 2px rgba(255,220,80,0.7); }
.zone-tip {
  position:absolute; top:4px; left:50%; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:1px;
  opacity:0; transition:opacity 0.2s; pointer-events:none;
  background:rgba(0,0,0,0.60); border-radius:6px; padding:3px 8px; white-space:nowrap;
}
.zone-hit:hover .zone-tip { opacity:1; }
.zone-tip-name { font-size:10px; color:#fff; font-family:monospace,sans-serif; }
.zone-drop-hint {
  position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
  background:rgba(255,220,80,0.95); color:#3a2800;
  font-size:12px; padding:4px 12px; border-radius:6px; font-weight:bold;
  pointer-events:none; white-space:nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* 反馈气泡 */
.feedback-bubble {
  position: absolute;
  background: linear-gradient(135deg, rgba(30,20,8,0.96), rgba(50,35,10,0.96));
  color: #ffe080;
  border: 2px solid #c8a040;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: bold;
  font-family: monospace, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,160,40,0.4);
  z-index: 100;
}
.bubble-fade-enter-active {
  animation: bubbleIn 0.25s ease-out;
}
.bubble-fade-leave-active {
  animation: bubbleOut 0.4s ease-in forwards;
}
@keyframes bubbleIn {
  from { opacity:0; transform:translateY(8px) scale(0.85); }
  to   { opacity:1; transform:translateY(0)   scale(1); }
}
@keyframes bubbleOut {
  from { opacity:1; transform:translateY(0) scale(1); }
  to   { opacity:0; transform:translateY(-12px) scale(0.9); }
}
.resize-handle {
  position: absolute;
  right: -36px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 64px;
  background: linear-gradient(180deg, #c8a030 0%, #e8c050 40%, #c8a030 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  pointer-events: auto;
  z-index: 20;
  border: 2px solid #fff8d0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.55), 0 0 0 1px rgba(200,160,40,0.6);
  transition: box-shadow 0.15s, transform 0.15s;
}
.resize-handle:hover {
  box-shadow: 0 4px 20px rgba(200,160,40,0.8), 0 0 0 2px #ffe060;
  transform: translateY(-50%) scaleX(1.1);
}
.resize-handle:active {
  transform: translateY(-50%) scaleX(0.95);
}
.resize-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  user-select: none;
}
.resize-arrow {
  font-size: 9px;
  color: #5a3800;
  line-height: 1;
  opacity: 0.85;
}
.resize-label {
  font-size: 9px;
  color: #3a2000;
  font-weight: bold;
  font-family: monospace, sans-serif;
  letter-spacing: -0.5px;
  writing-mode: vertical-lr;
  text-orientation: upright;
}
.level-bubble {
  position:absolute; top:-36px; left:50%; transform:translateX(-50%);
  background:rgba(20,14,8,0.9); color:#ffe080; border:2px solid #c8a040;
  border-radius:8px; padding:5px 14px; font-size:12px; font-family:monospace,sans-serif;
  pointer-events:none; animation:bubbleUp 2.5s ease-out forwards;
}
@keyframes bubbleUp {
  0%   { opacity:1; transform:translateX(-50%) translateY(0); }
  80%  { opacity:1; }
  100% { opacity:0; transform:translateX(-50%) translateY(-20px); }
}
.ctx-overlay { position:fixed; inset:0; z-index:10001; background:transparent; }
.ctx-menu {
  position:fixed; z-index:10002; background:rgba(20,14,8,0.96); border:2px solid #c8a040;
  border-radius:10px; padding:8px 0; min-width:180px; box-shadow:0 8px 32px rgba(0,0,0,0.65);
}
/* 缩放控制条 */
.ctx-scale-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 5px 16px;
}
.ctx-scale-btn {
  width: 26px; height: 26px;
  background: rgba(200,160,40,0.2);
  border: 1px solid rgba(200,160,60,0.4);
  border-radius: 6px;
  color: #e8c870;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s;
  display: flex; align-items: center; justify-content: center;
}
.ctx-scale-btn:hover { background: rgba(200,160,40,0.45); }
.ctx-scale-val {
  min-width: 46px;
  text-align: center;
  color: #ffe080;
  font-size: 13px;
  font-weight: bold;
  font-family: monospace, sans-serif;
}

/* 缩放指示器 */
.scale-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(20,14,8,0.90);
  color: #ffe080;
  border: 2px solid #c8a040;
  border-radius: 12px;
  padding: 5px 18px;
  font-size: 15px;
  font-weight: bold;
  font-family: monospace, sans-serif;
  pointer-events: none;
  white-space: nowrap;
  z-index: 200;
}

.ctx-title { padding:4px 16px 6px; color:#e8c870; font-size:12px; font-weight:bold; font-family:monospace,sans-serif; }
.ctx-hr { border:none; border-top:1px solid rgba(200,160,60,0.25); margin:3px 0; }
.ctx-item {
  display:block; width:100%; background:none; border:none; color:#e0d0b0;
  text-align:left; padding:6px 16px; cursor:pointer; font-size:12px;
  font-family:inherit; transition:background 0.12s;
}
.ctx-item:hover { background:rgba(200,160,60,0.18); color:#fff; }
.ctx-danger { color:#ff8888 !important; }
.ctx-danger:hover { background:rgba(200,60,60,0.2) !important; }
.qa-overlay {
  position:fixed; inset:0; z-index:10003; background:rgba(0,0,0,0.38);
  display:flex; align-items:flex-end; justify-content:flex-end; padding:0 24px 180px 0;
}
.qa-box {
  background:rgba(20,14,8,0.97); border:2px solid #c8a040;
  border-radius:12px; padding:16px; width:340px; box-shadow:0 8px 32px rgba(0,0,0,0.7);
}
.qa-head { display:flex; justify-content:space-between; align-items:center; color:#e8c870; font-size:13px; font-weight:bold; margin-bottom:10px; }
.qa-x { background:none; border:none; color:#e0c080; font-size:16px; cursor:pointer; line-height:1; padding:0 2px; }
.qa-x:hover { color:#ff9090; }
.qa-input {
  width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(200,160,60,0.3);
  border-radius:6px; color:#e8dcc0; padding:7px 10px; font-size:13px;
  outline:none; box-sizing:border-box; margin-bottom:8px; resize:none; font-family:inherit;
}
.qa-input:focus { border-color:#c8a040; }
.qa-ta { min-height:80px; }
.qa-zones { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
.qz-btn {
  background:rgba(255,255,255,0.07); border:1px solid rgba(200,160,60,0.25);
  border-radius:5px; color:#c8b888; padding:3px 8px; font-size:11px;
  cursor:pointer; transition:background 0.12s;
}
.qz-btn:hover { background:rgba(200,160,60,0.2); }
.qz-btn.active { background:rgba(200,160,60,0.35); border-color:#c8a040; color:#fff; }
.qa-drop {
  border:2px dashed rgba(200,160,60,0.3); border-radius:8px; padding:10px;
  text-align:center; color:#a09070; font-size:12px; margin-bottom:10px;
  transition:border-color 0.15s, background 0.15s;
}
.qa-drop.active { border-color:#c8a040; background:rgba(200,160,60,0.08); }
.link { color:#80c0f0; cursor:pointer; text-decoration:underline; }
.qa-file-list { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.qa-chip { background:rgba(200,160,60,0.2); border-radius:4px; padding:2px 6px; font-size:11px; color:#e0c890; }
.qa-actions { display:flex; justify-content:flex-end; }
.qa-save {
  background:linear-gradient(135deg,#c8a040,#a07820); border:none; border-radius:7px;
  color:#fff; padding:8px 18px; font-size:12px; cursor:pointer; font-family:inherit; transition:opacity 0.15s;
}
.qa-save:hover { opacity:0.85; }
.qa-save kbd { font-size:10px; background:rgba(255,255,255,0.2); border-radius:3px; padding:1px 4px; margin-left:6px; }
</style>
