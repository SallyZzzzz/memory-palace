import { writeFileSync } from 'fs'

const code = `<template>
  <div class="strip-pet" :style="stripStyle">
    <div class="bg-layers" @dblclick="openMain" @contextmenu.prevent="showMenu" @mousedown="startDragStrip">
      <canvas ref="canvasRef" class="ground-canvas" />
    </div>

    <div class="zones-overlay">
      <div
        v-for="zone in ZONES" :key="zone.id"
        class="zone-hit" :style="zoneHitStyle(zone)"
        :class="{ 'zone-active': dragOverZone === zone.id }"
        @click.stop="openZone(zone.id)"
        @dragover.prevent="dragOverZone = zone.id"
        @dragleave="dragOverZone = null"
        @drop.prevent="onZoneDrop($event, zone.id)"
      >
        <div class="zone-tip">
          <span>{{ zone.icon }}</span>
          <span class="zone-tip-name">{{ zone.name }}</span>
        </div>
        <div v-if="dragOverZone === zone.id" class="zone-drop-hint">放入</div>
      </div>
    </div>

    <div class="resize-handle" @mousedown.stop="startResize" title="拖拽调节宽度">⠿</div>
    <div v-if="levelUpVisible" class="level-bubble">🎉 {{ appStore.currentLevel.name }}</div>

    <Teleport to="body">
      <template v-if="menuVisible">
        <div class="ctx-overlay" @click.stop="menuVisible = false"></div>
        <div class="ctx-menu" :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }">
          <div class="ctx-title">🏰 像素小屋</div>
          <hr class="ctx-hr" />
          <button class="ctx-item" @click="openMain">🚪 进入宫殿</button>
          <button class="ctx-item" @click="triggerQuickAdd">✏️ 快速记录</button>
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
            <div class="qa-head">
              ✏️ 快速记录
              <button class="qa-x" @click="qaVisible = false">✕</button>
            </div>
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
              @dragover.prevent="qaFileHover = true"
              @dragleave="qaFileHover = false"
              @drop.prevent="onQAFileDrop">
              <span v-if="!qaFiles.length">
                📎 拖放文件，或
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

// ── 背景分层素材（每个 summer 场景的前景层）──────────────
import _s1fg  from '@/assets/bg/PNG/summer 1/4.png'
import _s1mid from '@/assets/bg/PNG/summer 1/3.png'
import _s2fg  from '@/assets/bg/PNG/summer 2/4.png'
import _s2mid from '@/assets/bg/PNG/summer 2/3.png'
import _s3fg  from '@/assets/bg/PNG/summer 3/4.png'
import _s3mid from '@/assets/bg/PNG/summer 3/3.png'
import _s5fg  from '@/assets/bg/PNG/summer5/4.png'
import _s5mid from '@/assets/bg/PNG/summer5/3.png'
import _s6fg  from '@/assets/bg/PNG/summer6/4.png'
import _s6mid from '@/assets/bg/PNG/summer6/3.png'
import _s7fg  from '@/assets/bg/PNG/summer7/4.png'
import _s7mid from '@/assets/bg/PNG/summer7/3.png'
import _groundSrc from '@/assets/bg/PNG/BG_01/Layers/Ground_01.png'

// 猫咪行走精灵图
import _catWalkSrc from '@/assets/bg/3 Cat/Walk.png'

const appStore = useAppStore()

// ── 常量 ────────────────────────────────────────────────
const ZONE_COUNT = 6
const STRIP_H    = 160
const MIN_W      = 400
const CAT_FRAMES = 8       // Walk.png 帧数
const CAT_FPS    = 8       // 猫咪动画帧率（每秒）

// ── 尺寸状态 ────────────────────────────────────────────
const stripW = ref(window.innerWidth)
const stripX = ref(0)
const stripY = ref(window.innerHeight - STRIP_H - 4)

// ── 区域定义（对应 summer 场景顺序）──────────────────────
const ZONES = [
  { id: 'garden' as ZoneId, icon: '🌱', name: '花园',   idx: 0 },
  { id: 'study'  as ZoneId, icon: '📚', name: '书房',   idx: 1 },
  { id: 'lounge' as ZoneId, icon: '🎨', name: '客厅',   idx: 2 },
  { id: 'lab'    as ZoneId, icon: '🔬', name: '实验室', idx: 3 },
  { id: 'store'  as ZoneId, icon: '📦', name: '仓库',   idx: 4 },
  { id: 'cellar' as ZoneId, icon: '🗝️', name: '地窖',  idx: 5 },
]

// 每个区域对应的前景图（fg）和中景图（mid）
const ZONE_FG_SRCS  = [_s1fg,  _s2fg,  _s3fg,  _s5fg,  _s6fg,  _s7fg]
const ZONE_MID_SRCS = [_s1mid, _s2mid, _s3mid, _s5mid, _s6mid, _s7mid]

const zoneUnitW = computed(() => stripW.value / ZONE_COUNT)

function zoneHitStyle(zone: typeof ZONES[0]) {
  return {
    left:   Math.round(zone.idx * zoneUnitW.value) + 'px',
    width:  Math.round(zoneUnitW.value) + 'px',
    top:    '0',
    height: '100%',
  }
}

const stripStyle = computed(() => ({
  left:   stripX.value + 'px',
  top:    stripY.value + 'px',
  width:  stripW.value + 'px',
  height: STRIP_H + 'px',
}))

// ── 图片预加载 ───────────────────────────────────────────
function loadImg(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

const zoneFgImgs  = ZONE_FG_SRCS.map(loadImg)
const zoneMidImgs = ZONE_MID_SRCS.map(loadImg)
const groundImg   = loadImg(_groundSrc)
const catWalkImg  = loadImg(_catWalkSrc)

// ── Canvas 主绘制 ────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId = 0
let fc = 0

// 猫咪状态（在客厅区域来回走）
let catX      = 0   // 像素坐标（非格）
let catDir    = 1   // 1=向右 -1=向左

function drawZoneBg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destW: number,
  destH: number,
  alpha = 1,
) {
  if (!img.complete || !img.naturalWidth) return

  ctx.save()
  ctx.globalAlpha = alpha

  // 剪切到当前区域，防止溢出
  ctx.beginPath()
  ctx.rect(destX, 0, destW, destH)
  ctx.clip()

  // 按宽度缩放，底部对齐
  const scale  = destW / img.naturalWidth
  const scaledH = img.naturalHeight * scale
  const drawY  = destH - scaledH   // 底部对齐

  ctx.drawImage(img, destX, drawY, destW, scaledH)
  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const W   = stripW.value
  const H   = STRIP_H
  const dpr = window.devicePixelRatio || 1

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width        = Math.round(W * dpr)
    canvas.height       = Math.round(H * dpr)
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
  }

  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = false

  const ZW = zoneUnitW.value

  // ── 地面纹理（横铺底部）──────────────────────────────
  if (groundImg.complete && groundImg.naturalWidth) {
    const gH     = 28   // 地面条高度（px）
    const gScale = gH / groundImg.naturalHeight
    const gW     = groundImg.naturalWidth * gScale
    for (let gx = 0; gx < W; gx += gW) {
      ctx.drawImage(groundImg, gx, H - gH, gW, gH)
    }
  } else {
    // 降级：纯色地面
    ctx.fillStyle = '#7a9b50'
    ctx.fillRect(0, H - 28, W, 14)
    ctx.fillStyle = '#5c7838'
    ctx.fillRect(0, H - 14, W, 14)
  }

  // ── 每个区域：中景 + 前景 ─────────────────────────────
  ZONES.forEach((zone) => {
    const bx  = Math.round(zone.idx * ZW)
    const bw  = Math.round(ZW)

    // 拖拽高亮
    if (dragOverZone.value === zone.id) {
      ctx.fillStyle = 'rgba(255,220,80,0.22)'
      ctx.fillRect(bx, 0, bw, H)
    }

    // 中景（透明度较低，营造层次感）
    drawZoneBg(ctx, zoneMidImgs[zone.idx], bx, bw, H, 0.6)
    // 前景（完整显示）
    drawZoneBg(ctx, zoneFgImgs[zone.idx], bx, bw, H, 1.0)
  })

  // ── 🐱 猫咪动画（客厅区来回走）───────────────────────
  const catZone   = ZONES[2]   // 客厅（lounge）
  const catZoneL  = Math.round(catZone.idx * ZW)
  const catZoneR  = catZoneL + Math.round(ZW)
  const catMargin = 20

  if (catWalkImg.complete && catWalkImg.naturalWidth > 0) {
    const frameW   = catWalkImg.naturalWidth / CAT_FRAMES
    const frameH   = catWalkImg.naturalHeight
    const catScale = (H * 0.32) / frameH   // 猫高约占条高 32%
    const catDrawW = frameW   * catScale
    const catDrawH = frameH   * catScale
    const catDrawY = H - catDrawH - 22     // 底部对齐（留地面空间）

    // 移动速度：1.2px/frame
    catX += catDir * 1.2
    if (catX + catDrawW >= catZoneR - catMargin) { catDir = -1 }
    if (catX           <= catZoneL + catMargin)  { catDir =  1 }

    // 当前帧（按 CAT_FPS 从 fc 换算）
    const catFrame = Math.floor(fc / (60 / CAT_FPS)) % CAT_FRAMES

    ctx.save()
    ctx.imageSmoothingEnabled = false

    if (catDir < 0) {
      // 向左：水平翻转
      ctx.translate(catX + catDrawW, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(
        catWalkImg,
        catFrame * frameW, 0, frameW, frameH,
        0, catDrawY, catDrawW, catDrawH,
      )
    } else {
      ctx.drawImage(
        catWalkImg,
        catFrame * frameW, 0, frameW, frameH,
        catX, catDrawY, catDrawW, catDrawH,
      )
    }

    // 猫咪阴影
    ctx.globalAlpha = 0.18
    ctx.fillStyle   = '#000'
    ctx.beginPath()
    ctx.ellipse(catX + catDrawW / 2, H - 20, catDrawW * 0.45, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  ctx.restore()
  fc++
  animId = requestAnimationFrame(draw)
}

// ── 拖拽条 ──────────────────────────────────────────────
let draggingStrip = false, dragStartX = 0, dragStartY = 0, dragStartSX = 0, dragStartSY = 0
function startDragStrip(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('resize-handle')) return
  draggingStrip = true
  dragStartX = e.clientX; dragStartY = e.clientY
  dragStartSX = stripX.value; dragStartSY = stripY.value
  window.addEventListener('mousemove', onDragStrip)
  window.addEventListener('mouseup',   stopDragStrip)
}
function onDragStrip(e: MouseEvent) {
  if (!draggingStrip) return
  stripX.value = dragStartSX + (e.clientX - dragStartX)
  stripY.value = dragStartSY + (e.clientY - dragStartY)
}
function stopDragStrip() {
  draggingStrip = false
  window.removeEventListener('mousemove', onDragStrip)
  window.removeEventListener('mouseup',   stopDragStrip)
}

// ── 调节宽度 ────────────────────────────────────────────
let resizing = false, resizeStartX = 0, resizeStartW = 0
function startResize(e: MouseEvent) {
  resizing = true; resizeStartX = e.clientX; resizeStartW = stripW.value
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup',   stopResize)
}
function onResize(e: MouseEvent) {
  if (!resizing) return
  stripW.value = Math.max(MIN_W, Math.min(window.innerWidth - stripX.value, resizeStartW + (e.clientX - resizeStartX)))
}
function stopResize() {
  resizing = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup',   stopResize)
}

// ── 拖放文件 ────────────────────────────────────────────
const dragOverZone = ref<ZoneId | null>(null)
function onZoneDrop(e: DragEvent, zoneId: ZoneId) {
  dragOverZone.value = null
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) { files.forEach(f => appStore.addFileToZone(zoneId, f)); showLevelUp() }
}

// ── 导航 ────────────────────────────────────────────────
const emit = defineEmits<{ (e: 'open-main'): void; (e: 'open-zone', id: ZoneId): void }>()
function openMain()           { menuVisible.value = false; emit('open-main') }
function openZone(id: ZoneId) { menuVisible.value = false; emit('open-zone', id) }

// ── 右键菜单 ─────────────────────────────────────────────
const menuVisible = ref(false)
const menuPos     = ref({ x: 0, y: 0 })
function showMenu(e: MouseEvent) { menuPos.value = { x: e.clientX, y: e.clientY }; menuVisible.value = true }
function exitApp() { menuVisible.value = false; (window as any).__TAURI__?.process?.exit(0) }

// ── 快速记录 ─────────────────────────────────────────────
const qaVisible   = ref(false)
const qaTitle     = ref('')
const qaBody      = ref('')
const qaZone      = ref<ZoneId>('lounge')
const qaFiles     = ref<File[]>([])
const qaFileHover = ref(false)
const qaInputRef  = ref<HTMLInputElement | null>(null)
const qaBodyRef   = ref<HTMLTextAreaElement | null>(null)
const qaBoxRef    = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const qaBoxStyle  = computed(() => ({ bottom: (STRIP_H + 16) + 'px', right: '24px' }))

function triggerQuickAdd() {
  menuVisible.value = false
  qaTitle.value = ''; qaBody.value = ''; qaFiles.value = []; qaZone.value = 'lounge'
  qaVisible.value = true
  nextTick(() => qaInputRef.value?.focus())
}
async function submitQA() {
  if (!qaTitle.value.trim() && !qaBody.value.trim() && !qaFiles.value.length) return
  await createEntry({ zoneId: qaZone.value, title: qaTitle.value.trim() || '快速记录', body: qaBody.value.trim(), files: qaFiles.value })
  qaVisible.value = false; showLevelUp()
}
function onQAFileDrop(e: DragEvent) {
  qaFileHover.value = false
  qaFiles.value = [...qaFiles.value, ...Array.from(e.dataTransfer?.files ?? [])]
}
function onFileSelect(e: Event) {
  const t = e.target as HTMLInputElement
  if (t.files) qaFiles.value = [...qaFiles.value, ...Array.from(t.files)]
}

// ── 升级气泡 ─────────────────────────────────────────────
const levelUpVisible = ref(false)
function showLevelUp() { levelUpVisible.value = true; setTimeout(() => { levelUpVisible.value = false }, 2500) }

// ── ESC 关闭 ─────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { menuVisible.value = false; qaVisible.value = false }
}

// ── 生命周期 ─────────────────────────────────────────────
onMounted(() => {
  stripW.value = window.innerWidth
  stripX.value = 0
  stripY.value = window.innerHeight - STRIP_H - 4
  catX = Math.round(ZONES[2].idx * (window.innerWidth / ZONE_COUNT)) + 40

  nextTick(() => { animId = requestAnimationFrame(draw) })
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', () => {
    stripW.value = window.innerWidth
    stripX.value = 0
    stripY.value = window.innerHeight - STRIP_H - 4
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousemove', onDragStrip)
  window.removeEventListener('mouseup',   stopDragStrip)
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup',   stopResize)
})
</script>

<style scoped>
.strip-pet {
  position: fixed;
  z-index: 9999;
  user-select: none;
  pointer-events: none;
}
.bg-layers {
  position: absolute; inset: 0;
  pointer-events: auto;
  cursor: grab;
}
.bg-layers:active { cursor: grabbing; }
.ground-canvas {
  position: absolute; inset: 0;
  image-rendering: pixelated;
}
.zones-overlay {
  position: absolute; inset: 0;
  pointer-events: auto;
}
.zone-hit {
  position: absolute;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 4px;
}
.zone-hit:hover { background: rgba(255,255,255,0.07); }
.zone-hit.zone-active { background: rgba(255,220,80,0.2); box-shadow: inset 0 0 0 2px rgba(255,220,80,0.7); }
.zone-tip {
  position: absolute; top: 4px; left: 50%;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  opacity: 0; transition: opacity 0.2s;
  pointer-events: none;
  background: rgba(0,0,0,0.6); border-radius: 6px; padding: 3px 8px; white-space: nowrap;
}
.zone-hit:hover .zone-tip { opacity: 1; }
.zone-tip-name { font-size: 10px; color: #fff; font-family: monospace, sans-serif; }
.zone-drop-hint {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(255,220,80,0.92); color: #3a2800;
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: bold; pointer-events: none;
}
.resize-handle {
  position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
  width: 18px; height: 40px;
  background: rgba(80,60,40,0.75); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: ew-resize; pointer-events: auto; color: #e0c890; font-size: 13px; z-index: 10;
  border: 1px solid rgba(255,220,100,0.35);
}
.level-bubble {
  position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
  background: rgba(20,14,8,0.9); color: #ffe080;
  border: 2px solid #c8a040; border-radius: 8px; padding: 5px 14px;
  font-size: 12px; font-family: monospace, sans-serif; pointer-events: none;
  animation: bubbleUp 2.5s ease-out forwards;
}
@keyframes bubbleUp {
  0%   { opacity:1; transform:translateX(-50%) translateY(0); }
  80%  { opacity:1; }
  100% { opacity:0; transform:translateX(-50%) translateY(-20px); }
}
.ctx-overlay { position:fixed; inset:0; z-index:10001; background:transparent; }
.ctx-menu {
  position:fixed; z-index:10002;
  background:rgba(20,14,8,0.96); border:2px solid #c8a040;
  border-radius:10px; padding:8px 0; min-width:180px;
  box-shadow:0 8px 32px rgba(0,0,0,0.65);
}
.ctx-title { padding:4px 16px 6px; color:#e8c870; font-size:12px; font-weight:bold; font-family:monospace,sans-serif; }
.ctx-hr { border:none; border-top:1px solid rgba(200,160,60,0.25); margin:3px 0; }
.ctx-item {
  display:block; width:100%; background:none; border:none;
  color:#e0d0b0; text-align:left; padding:6px 16px;
  cursor:pointer; font-size:12px; font-family:inherit; transition:background 0.12s;
}
.ctx-item:hover { background:rgba(200,160,60,0.18); color:#fff; }
.ctx-danger { color:#ff8888 !important; }
.ctx-danger:hover { background:rgba(200,60,60,0.2) !important; }
.qa-overlay {
  position:fixed; inset:0; z-index:10003;
  background:rgba(0,0,0,0.38);
  display:flex; align-items:flex-end; justify-content:flex-end;
  padding:0 24px 180px 0;
}
.qa-box {
  background:rgba(20,14,8,0.97); border:2px solid #c8a040;
  border-radius:12px; padding:16px; width:340px;
  box-shadow:0 8px 32px rgba(0,0,0,0.7);
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
.qz-btn { background:rgba(255,255,255,0.07); border:1px solid rgba(200,160,60,0.25); border-radius:5px; color:#c8b888; padding:3px 8px; font-size:11px; cursor:pointer; transition:background 0.12s; }
.qz-btn:hover { background:rgba(200,160,60,0.2); }
.qz-btn.active { background:rgba(200,160,60,0.35); border-color:#c8a040; color:#fff; }
.qa-drop {
  border:2px dashed rgba(200,160,60,0.3); border-radius:8px;
  padding:10px; text-align:center; color:#a09070; font-size:12px; margin-bottom:10px;
  transition:border-color 0.15s, background 0.15s;
}
.qa-drop.active { border-color:#c8a040; background:rgba(200,160,60,0.08); }
.link { color:#80c0f0; cursor:pointer; text-decoration:underline; }
.qa-file-list { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; }
.qa-chip { background:rgba(200,160,60,0.2); border-radius:4px; padding:2px 6px; font-size:11px; color:#e0c890; }
.qa-actions { display:flex; justify-content:flex-end; }
.qa-save {
  background:linear-gradient(135deg,#c8a040,#a07820); border:none;
  border-radius:7px; color:#fff; padding:8px 18px; font-size:12px;
  cursor:pointer; font-family:inherit; transition:opacity 0.15s;
}
.qa-save:hover { opacity:0.85; }
.qa-save kbd { font-size:10px; background:rgba(255,255,255,0.2); border-radius:3px; padding:1px 4px; margin-left:6px; }
</style>
`

writeFileSync('src/components/pixel/PixelHouse.vue', code, 'utf8')
console.log('✅ 写入完成，行数：', code.split('\n').length)