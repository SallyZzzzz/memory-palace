<template>
  <div
    class="zone-card"
    :class="[bgClass, { 'zone-card--hover': isHovered }]"
    :style="{ '--zone-color': zoneColor }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="$emit('click')"
  >
    <!-- 区域像素装饰角标 -->
    <div class="zone-corner tl" />
    <div class="zone-corner tr" />
    <div class="zone-corner bl" />
    <div class="zone-corner br" />

    <!-- 区域内容 -->
    <div class="zone-inner">
      <!-- 图标 + 名称 -->
      <div class="zone-head">
        <span class="zone-emoji">{{ ZONE_ICONS[zone] }}</span>
        <div>
          <div class="zone-name">{{ appStore.getZoneName(zone) }}</div>
          <div class="zone-desc">{{ description }}</div>
        </div>
      </div>

      <!-- 条目计数 -->
      <div class="zone-count">
        <span class="count-num">{{ count }}</span>
        <span class="count-label">条内容</span>
      </div>

      <!-- 悬停时显示的进入提示 -->
      <Transition name="fade">
        <div v-if="isHovered" class="zone-enter">
          点击进入 →
        </div>
      </Transition>

      <!-- 像素装饰图案 -->
      <div class="zone-deco">
        <template v-if="zone === 'garden'">🌻🌸🌿</template>
        <template v-else-if="zone === 'store'">📦🗃️⚙️</template>
        <template v-else-if="zone === 'lounge'">🗒️📌✏️</template>
        <template v-else-if="zone === 'study'">📖🖊️📋</template>
        <template v-else-if="zone === 'lab'">🔬⚗️🔗</template>
        <template v-else>🕳️📁🗑️</template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import { ZONE_ICONS, ZONE_COLORS } from '@/db/types'
import type { ZoneId } from '@/db/types'
import { getEntriesByZone, getDeletedEntries } from '@/db'

const props = defineProps<{
  zone: ZoneId
  bgClass?: string
  description?: string
  level?: number
}>()
defineEmits(['click'])

const appStore = useAppStore()
const isHovered = ref(false)
const zoneColor = computed(() => ZONE_COLORS[props.zone])
const count = computed(() =>
  props.zone === 'cellar'
    ? getDeletedEntries().length
    : getEntriesByZone(props.zone).length
)
</script>

<style scoped>
.zone-card {
  flex: 1;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border: 3px solid var(--zone-color, var(--color-panel-border));
  background: rgba(245, 230, 200, 0.82);
  box-shadow:
    4px 4px 0 rgba(0,0,0,0.25),
    inset 0 0 0 1px rgba(255,255,255,0.3);
  transition: transform 0.1s, box-shadow 0.1s;
  backdrop-filter: blur(2px);
}
.zone-card--hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow:
    6px 7px 0 rgba(0,0,0,0.3),
    0 0 12px var(--zone-color),
    inset 0 0 0 1px rgba(255,255,255,0.4);
}

/* 像素角标 */
.zone-corner {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--zone-color);
  z-index: 1;
}
.tl { top: -1px;  left: -1px; }
.tr { top: -1px;  right: -1px; }
.bl { bottom: -1px; left: -1px; }
.br { bottom: -1px; right: -1px; }

.zone-inner {
  padding: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.zone-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.zone-emoji {
  font-size: 24px;
  line-height: 1;
  filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.2));
}
.zone-name {
  font-family: 'PixelFont', monospace;
  font-size: 12px;
  color: var(--color-panel-dark);
  margin-bottom: 3px;
}
.zone-desc {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: var(--color-panel-border);
  line-height: 1.4;
}

.zone-count {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.count-num {
  font-family: 'PixelFont', monospace;
  font-size: 20px;
  color: var(--zone-color);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.15);
}
.count-label {
  font-family: 'PixelFont', monospace;
  font-size: 9px;
  color: var(--color-panel-border);
}

.zone-enter {
  font-family: 'PixelFont', monospace;
  font-size: 10px;
  color: var(--zone-color);
  text-align: right;
}

.zone-deco {
  font-size: 16px;
  opacity: 0.3;
  text-align: right;
  letter-spacing: 2px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
