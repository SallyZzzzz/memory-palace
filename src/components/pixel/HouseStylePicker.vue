<template>
  <div class="picker-overlay">
    <!-- 背景星空粒子 -->
    <canvas ref="bgCanvas" class="bg-canvas" />

    <div class="picker-wrap">
      <!-- 标题区 -->
      <div class="picker-header">
        <div class="picker-title">
          <span class="title-pixel">✦</span>
          欢迎来到像素小屋
          <span class="title-pixel">✦</span>
        </div>
        <div class="picker-subtitle">选择你的初始房型 · 之后可以通过成长解锁更多外观</div>
      </div>

      <!-- 四个房屋卡片 -->
      <div class="houses-grid">
        <div
          v-for="style in STYLES"
          :key="style"
          class="house-card"
          :class="{ selected: selected === style, hovered: hovered === style }"
          :style="{ '--accent': HOUSE_STYLE_META[style].palette[0] }"
          @mouseenter="hovered = style"
          @mouseleave="hovered = null"
          @click="selected = style"
        >
          <!-- 像素房屋 Canvas -->
          <div class="canvas-wrap">
            <canvas
              :ref="el => setCanvasRef(el as HTMLCanvasElement, style)"
              :width="DISPLAY_SIZE"
              :height="DISPLAY_SIZE"
              class="house-canvas"
            />
            <!-- 选中光圈 -->
            <div v-if="selected === style" class="select-ring" />
          </div>

          <!-- 调色板预览 -->
          <div class="palette-row">
            <span
              v-for="c in HOUSE_STYLE_META[style].palette"
              :key="c"
              class="palette-dot"
              :style="{ background: c }"
            />
          </div>

          <!-- 房型信息 -->
          <div class="house-info">
            <div class="house-name">{{ HOUSE_STYLE_META[style].name }}</div>
            <div class="house-desc">{{ HOUSE_STYLE_META[style].desc }}</div>
            <div class="house-flavor">{{ HOUSE_STYLE_META[style].flavor }}</div>
          </div>

          <!-- 选中标记 -->
          <div v-if="selected === style" class="selected-badge">✓ 已选择</div>
        </div>
      </div>

      <!-- 确认按钮 -->
      <div class="picker-footer">
        <div class="footer-hint">
          🏰 选好后，你的小屋将从这个外观开始成长...
        </div>
        <button
          class="confirm-btn pixel-btn"
          :class="{ 'confirm-ready': !!selected }"
          :disabled="!selected"
          @click="confirm"
        >
          {{ selected ? `✦ 以「${HOUSE_STYLE_META[selected!].name}」开始冒险` : '请先选择一种房型' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { drawHouseStyle, HOUSE_STYLE_META } from './HouseStyles'
import type { HouseStyle } from './HouseStyles'

const emit = defineEmits<{ confirm: [style: HouseStyle] }>()

const STYLES: HouseStyle[] = ['cottage', 'mushroom', 'workshop', 'oriental']
const DISPLAY_SIZE = 192  // 48 * 4 倍放大

const selected = ref<HouseStyle | null>(null)
const hovered = ref<HouseStyle | null>(null)

// Canvas refs
const canvasMap = new Map<HouseStyle, HTMLCanvasElement>()
function setCanvasRef(el: HTMLCanvasElement, style: HouseStyle) {
  if (el) canvasMap.set(style, el)
}

// 动画帧
let frame = 0
let animId = 0

function renderAll() {
  for (const style of STYLES) {
    const canvas = canvasMap.get(style)
    if (!canvas) continue
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.imageSmoothingEnabled = false
    drawHouseStyle(ctx, style, DISPLAY_SIZE, frame)
  }
  frame++
  animId = requestAnimationFrame(renderAll)
}

// 背景粒子 canvas
const bgCanvas = ref<HTMLCanvasElement>()
let bgAnimId = 0
const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number }[] = []

function initParticles() {
  const colors = ['#f5c518', '#c8864a', '#5aa02c', '#2060e0', '#e03030', '#c080ff', '#e0c040']
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.floor(Math.random() * 3) + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.6 + 0.2,
    })
  }
}

function renderBg() {
  if (!bgCanvas.value) return
  const ctx = bgCanvas.value.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, bgCanvas.value.width, bgCanvas.value.height)

  for (const p of particles) {
    p.x += p.vx; p.y += p.vy
    if (p.x < 0) p.x = bgCanvas.value.width
    if (p.x > bgCanvas.value.width) p.x = 0
    if (p.y < 0) p.y = bgCanvas.value.height
    if (p.y > bgCanvas.value.height) p.y = 0
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(frame * 0.05 + p.x))
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size)
  }
  ctx.globalAlpha = 1
  bgAnimId = requestAnimationFrame(renderBg)
}

function confirm() {
  if (!selected.value) return
  // 保存到 localStorage
  localStorage.setItem('ph_house_style', selected.value)
  emit('confirm', selected.value)
}

onMounted(() => {
  // 设置背景 canvas 尺寸
  if (bgCanvas.value) {
    bgCanvas.value.width = window.innerWidth
    bgCanvas.value.height = window.innerHeight
  }
  initParticles()
  bgAnimId = requestAnimationFrame(renderBg)
  // 延迟一帧让 canvas refs 挂载
  setTimeout(() => {
    animId = requestAnimationFrame(renderAll)
  }, 50)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  cancelAnimationFrame(bgAnimId)
})
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1228;
  overflow: hidden;
}

.bg-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.picker-wrap {
  position: relative;
  z-index: 1;
  width: min(960px, 96vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

/* 标题 */
.picker-header { text-align: center; }
.picker-title {
  font-family: 'PixelFont', monospace;
  font-size: 18px;
  color: #f5c518;
  text-shadow:
    0 0 8px rgba(245,197,24,0.6),
    2px 2px 0 rgba(0,0,0,0.5);
  margin-bottom: 8px;
  letter-spacing: 2px;
}
.title-pixel {
  display: inline-block;
  animation: pixel-float 1.5s ease-in-out infinite alternate;
  margin: 0 8px;
}
.picker-subtitle {
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 1px;
}

/* 网格 */
.houses-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  width: 100%;
}

/* 房屋卡片 */
.house-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  background: rgba(255,255,255,0.05);
  border: 2px solid rgba(255,255,255,0.1);
  cursor: pointer;
  transition: transform 0.12s, border-color 0.15s, background 0.15s;
  position: relative;
  --accent: #f5c518;
}
.house-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
}
.house-card.selected {
  border-color: var(--accent);
  background: rgba(255,255,255,0.1);
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 24px color-mix(in srgb, var(--accent) 50%, transparent);
}

/* 画布区 */
.canvas-wrap {
  position: relative;
  width: 192px;
  height: 192px;
}
.house-canvas {
  width: 192px;
  height: 192px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  display: block;
}
.select-ring {
  position: absolute;
  inset: -4px;
  border: 3px solid var(--accent);
  animation: ring-pulse 1s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes ring-pulse {
  from { opacity: 0.6; }
  to   { opacity: 1; box-shadow: 0 0 8px var(--accent); }
}

/* 调色板 */
.palette-row {
  display: flex;
  gap: 4px;
}
.palette-dot {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255,255,255,0.2);
}

/* 文字信息 */
.house-info { text-align: center; width: 100%; }
.house-name {
  font-family: 'PixelFont', monospace;
  font-size: 12px;
  color: #fff;
  margin-bottom: 4px;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
}
.house-desc {
  font-family: 'PixelFont', monospace;
  font-size: 8px;
  color: rgba(255,255,255,0.5);
  line-height: 1.6;
  margin-bottom: 4px;
}
.house-flavor {
  font-family: 'PixelFont', monospace;
  font-size: 8px;
  color: var(--accent);
  opacity: 0.8;
  line-height: 1.5;
}

/* 选中徽章 */
.selected-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--accent);
  color: #1a1228;
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  padding: 2px 6px;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
}

/* 底部 */
.picker-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.footer-hint {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 1px;
}
.confirm-btn {
  font-size: 12px !important;
  padding: 10px 28px !important;
  background: #3a3a4a !important;
  color: rgba(255,255,255,0.4) !important;
  border: 2px solid rgba(255,255,255,0.15) !important;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.4) !important;
  cursor: not-allowed;
  transition: all 0.2s;
  letter-spacing: 1px;
}
.confirm-btn.confirm-ready {
  background: var(--color-grass, #5aa02c) !important;
  color: #fff !important;
  border-color: var(--color-grass-dark, #3d7a1a) !important;
  cursor: pointer;
  animation: confirm-pulse 1.5s ease-in-out infinite alternate;
}
@keyframes confirm-pulse {
  from { box-shadow: 3px 3px 0 rgba(0,0,0,0.4); }
  to   { box-shadow: 3px 3px 0 rgba(0,0,0,0.4), 0 0 12px rgba(90,160,44,0.6); }
}
.confirm-btn:active.confirm-ready {
  transform: translate(2px,2px);
  box-shadow: 1px 1px 0 rgba(0,0,0,0.4) !important;
}
</style>
