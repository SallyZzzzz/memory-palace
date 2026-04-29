<template>
  <!-- 右键空白处关闭整个界面 -->
  <div class="zone-layout" :style="{ '--zone-color': zoneColor }"
    @contextmenu.self.prevent="closeZone">

    <!-- 顶栏：只显示区域名 + 关闭按钮 -->
    <div class="zone-topbar">
      <span class="zone-title">
        {{ ZONE_ICONS[zone] }} {{ appStore.getZoneName(zone) }}
      </span>
      <div class="zone-topbar-actions">
        <slot name="actions" />
        <button class="close-btn" title="关闭 (右键空白处)" @click="closeZone">✕</button>
      </div>
    </div>

    <!-- 主内容区：右键空白处也能关闭，position:relative 为内部模态框提供定位基准 -->
    <div class="zone-content" @contextmenu.self.prevent="closeZone">
      <slot />
      <!-- 内联模态框插槽（替代 Teleport，避免全屏板子残留） -->
      <slot name="modal" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/app'
import { ZONE_ICONS, ZONE_COLORS } from '@/db/types'
import type { ZoneId } from '@/db/types'

const props = defineProps<{ zone: ZoneId }>()

const appStore = useAppStore()
const zoneColor = computed(() => ZONE_COLORS[props.zone])

function closeZone() {
  appStore.activeZone      = null
  appStore.isMainWindowOpen = false
}

// ESC 也能关闭
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeZone()
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.zone-layout {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--color-panel-bg);
  --zone-color: var(--color-wood);
}

/* 顶栏 */
.zone-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--zone-color);
  border-bottom: 3px solid rgba(0,0,0,0.2);
  min-height: 36px;
}

.zone-title {
  font-family: 'PixelFont', monospace;
  font-size: 12px; color: #fff;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.35);
  user-select: none;
}

.zone-topbar-actions {
  display: flex; align-items: center; gap: 6px;
}

.close-btn {
  background: rgba(192,57,43,0.7);
  border: 2px solid rgba(255,255,255,0.25);
  color: #fff; font-family: 'PixelFont', monospace;
  font-size: 11px; padding: 3px 8px; cursor: pointer;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.2);
  transition: background 0.12s;
}
.close-btn:hover { background: rgba(192,57,43,1); }

/* 内容区 */
.zone-content { flex: 1; overflow: hidden; position: relative; }
/* modal 插槽的绝对定位参照就是 zone-content */
</style>