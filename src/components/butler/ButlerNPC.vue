<template>
  <div class="butler-wrap">
    <!-- 管家气泡 -->
    <Transition name="bubble">
      <div v-if="appStore.butlerVisible" class="butler-bubble pixel-panel">
        <div class="bubble-text">{{ appStore.butlerMessage }}</div>
        <div class="bubble-tail" />
      </div>
    </Transition>

    <!-- 管家主体（像素Canvas） -->
    <div
      class="butler-body"
      :class="{ 'butler-happy': mood === 'happy', 'butler-sad': mood === 'sad' }"
      @click="onButlerClick"
      title="点击管家呼出设置"
    >
      <canvas ref="butlerCanvas" width="48" height="64" />
      <!-- 帽子（庆祝时） -->
      <div v-if="appStore.petState === 'celebrating'" class="party-hat">🎉</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()
const butlerCanvas = ref<HTMLCanvasElement>()
let animId = 0
let frame = 0

const mood = computed(() => {
  if (appStore.petState === 'celebrating') return 'happy'
  if (appStore.petState === 'lonely') return 'sad'
  return 'normal'
})

// 管家随机问候语
const GREETINGS = [
  '主人，今天想记录什么呢？✨',
  '有新灵感了吗？快存进花园！🌷',
  '工坊里发现了有趣的关联，要去看看吗？🔬',
  '今天天气不错，适合写点什么～📖',
  '仓库里的素材整理好了吗？📦',
]

function onButlerClick() {
  const msg = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  appStore.showButlerMessage(msg)
}

// 绘制像素管家
function drawButler(ctx: CanvasRenderingContext2D, f: number, skin: typeof appStore.settings.butlerSkin) {
  ctx.clearRect(0, 0, 48, 64)
  const s = 2  // 每像素2px

  const hairColors = ['#3d2b1f', '#c8a060', '#e8d0a0', '#ff6b6b', '#6b8dd6']
  const clothColors = ['#6b8dd6', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c']

  const hc = hairColors[skin.hairStyle % hairColors.length] || skin.hairColor
  const cc = clothColors[skin.eyeStyle % clothColors.length] || skin.clothColor

  const isHappy = mood.value === 'happy'
  const isSad = mood.value === 'sad'
  const bob = Math.sin(f * 0.08) * (isHappy ? 2 : 1)

  const ox = 4
  const oy = Math.round(bob)

  // 身体
  fill(ctx, ox+4, oy+18, 16, 14, s, cc)
  fill(ctx, ox+4, oy+18, 2, 14, s, darken(cc))  // 左阴影

  // 领子
  fill(ctx, ox+6, oy+18, 12, 2, s, '#fff')

  // 头
  fill(ctx, ox+4, oy+6,  16, 12, s, '#fde8c8')
  fill(ctx, ox+4, oy+6,  2,  12, s, '#e8c8a0')  // 阴影

  // 头发（根据样式）
  fill(ctx, ox+4, oy+4,  16, 4, s, hc)
  if (skin.hairStyle === 1) {  // 呆毛
    fill(ctx, ox+10, oy+2, 4, 4, s, hc)
  }

  // 眼睛
  const eyeY = oy + 10
  if (isSad) {
    fill(ctx, ox+7,  eyeY, 2, 2, s, '#4a3020')
    fill(ctx, ox+15, eyeY, 2, 2, s, '#4a3020')
    // 悲伤眉毛（斜）
    fill(ctx, ox+6,  eyeY-2, 2, 1, s, '#4a3020')
    fill(ctx, ox+15, eyeY-3, 2, 1, s, '#4a3020')
  } else {
    fill(ctx, ox+7,  eyeY, 2, 2, s, '#2c1810')
    fill(ctx, ox+15, eyeY, 2, 2, s, '#2c1810')
    // 眼睛高光
    fill(ctx, ox+7,  eyeY, 1, 1, s, '#fff')
    fill(ctx, ox+15, eyeY, 1, 1, s, '#fff')
  }

  // 嘴巴
  const mouthY = oy + 14
  if (isHappy) {
    fill(ctx, ox+9,  mouthY, 6, 1, s, '#c08060')
    fill(ctx, ox+8,  mouthY-1, 1, 1, s, '#c08060')
    fill(ctx, ox+15, mouthY-1, 1, 1, s, '#c08060')
  } else if (isSad) {
    fill(ctx, ox+9,  mouthY+1, 6, 1, s, '#c08060')
    fill(ctx, ox+8,  mouthY+2, 1, 1, s, '#c08060')
    fill(ctx, ox+15, mouthY+2, 1, 1, s, '#c08060')
  } else {
    fill(ctx, ox+9, mouthY, 6, 1, s, '#c08060')
  }

  // 手臂
  const armWave = isHappy ? Math.sin(f * 0.2) * 3 : 0
  fill(ctx, ox+2,  oy+20, 2, 8, s, cc)  // 左
  fill(ctx, ox+20, oy+20 - armWave, 2, 8, s, cc) // 右（开心时挥手）

  // 腿
  fill(ctx, ox+6,  oy+32, 4, 8, s, '#3d2b1f')
  fill(ctx, ox+14, oy+32, 4, 8, s, '#3d2b1f')
  // 鞋子
  fill(ctx, ox+5,  oy+38, 6, 2, s, '#1a1a1a')
  fill(ctx, ox+13, oy+38, 6, 2, s, '#1a1a1a')
}

function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x * s, y * s, w * s, h * s)
}

function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (n >> 16) - 40)
  const g = Math.max(0, ((n >> 8) & 0xff) - 40)
  const b = Math.max(0, (n & 0xff) - 40)
  return `rgb(${r},${g},${b})`
}

function loop() {
  if (!butlerCanvas.value) return
  const ctx = butlerCanvas.value.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  drawButler(ctx, frame, appStore.settings.butlerSkin)
  frame++
  animId = requestAnimationFrame(loop)
}

onMounted(() => { animId = requestAnimationFrame(loop) })
onUnmounted(() => cancelAnimationFrame(animId))
</script>

<style scoped>
.butler-wrap {
  position: absolute;
  right: 32px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.butler-body {
  cursor: pointer;
  position: relative;
  transition: transform 0.1s;
}
.butler-body:hover { transform: scale(1.05); }
.butler-body:active { transform: scale(0.95); }
.butler-body canvas {
  image-rendering: pixelated;
  filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.3));
}

.butler-happy { animation: butler-bounce 0.5s ease-in-out infinite alternate; }
.butler-sad   { filter: saturate(0.5); }

@keyframes butler-bounce {
  from { transform: translateY(0); }
  to   { transform: translateY(-4px); }
}

/* 庆祝帽 */
.party-hat {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
  animation: hat-wiggle 0.3s ease-in-out infinite alternate;
}
@keyframes hat-wiggle {
  from { transform: translateX(-50%) rotate(-10deg); }
  to   { transform: translateX(-50%) rotate(10deg); }
}

/* 气泡 */
.butler-bubble {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 200px;
  padding: 10px 12px;
  z-index: 20;
}
.bubble-text {
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  color: var(--color-panel-dark);
  line-height: 1.6;
}
.bubble-tail {
  position: absolute;
  bottom: -10px;
  right: 20px;
  width: 0;
  height: 0;
  border: 5px solid transparent;
  border-top-color: var(--color-panel-border);
}

.bubble-enter-active { animation: bubble-pop 0.3s ease-out; }
.bubble-leave-active { animation: bubble-pop 0.2s ease-in reverse; }

@keyframes bubble-pop {
  from { transform: scale(0.5) translateY(8px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}
</style>
