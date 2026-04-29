<template>
  <div id="app-root">
    <!-- 首次启动：房型选择界面 -->
    <Transition name="picker-fade">
      <HouseStylePicker
        v-if="showPicker"
        @confirm="onStyleConfirmed"
      />
    </Transition>

    <!-- 主应用（选择后显示） -->
    <template v-if="!showPicker">
      <PixelHouse />
      <Transition name="window">
        <div v-if="appStore.isMainWindowOpen && appStore.activeZone" class="main-window pixel-panel">
          <Transition name="zone-slide" mode="out-in">
            <component :is="activeZoneComponent" :key="appStore.activeZone" />
          </Transition>
        </div>
      </Transition>

      <!-- 全局：猫咪聊天面板 -->
      <CatChat />

      <!-- 全局：设置弹窗 -->
      <SettingsModal v-if="appStore.showSettings" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import PixelHouse from '@/components/pixel/PixelHouse.vue'
import HouseStylePicker from '@/components/pixel/HouseStylePicker.vue'
// CastleView 已移除（不再需要空状态城堡板子）
import GardenView from '@/modules/garden/GardenView.vue'
import StoreView  from '@/modules/store/StoreView.vue'
import LoungeView from '@/modules/lounge/LoungeView.vue'
import StudyView  from '@/modules/study/StudyView.vue'
import LabView    from '@/modules/lab/LabView.vue'
import CellarView from '@/modules/cellar/CellarView.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import CatChat from '@/components/CatChat.vue'
import type { HouseStyle } from '@/components/pixel/HouseStyles'

const appStore = useAppStore()

// 首次启动检测
const showPicker = ref(!localStorage.getItem('ph_house_style'))

function onStyleConfirmed(style: HouseStyle) {
  // 应用选中风格到设置
  appStore.updateSettings({ petStyle: style as any })
  // 淡出选择界面，进入主应用
  showPicker.value = false
}

const ZONE_COMPONENTS = { garden: GardenView, store: StoreView, lounge: LoungeView, study: StudyView, lab: LabView, cellar: CellarView }
const activeZoneComponent = computed(() => appStore.activeZone ? ZONE_COMPONENTS[appStore.activeZone] : null)
</script>

<style>
#app-root { width: 100vw; height: 100vh; overflow: hidden; position: relative; background: transparent; }
.main-window { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 860px; height: 580px; z-index: 1000; overflow: hidden; border: 4px solid var(--color-panel-border); box-shadow: 8px 8px 0 rgba(0,0,0,0.4), inset 2px 2px 0 rgba(255,255,255,0.3); }
.window-enter-active, .window-leave-active { transition: all 0.25s ease; }
.window-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
.window-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
.zone-slide-enter-active, .zone-slide-leave-active { transition: all 0.2s ease; }
.zone-slide-enter-from { opacity: 0; transform: translateX(20px); }
.zone-slide-leave-to { opacity: 0; transform: translateX(-20px); }

/* 房型选择界面淡出 */
.picker-fade-leave-active { transition: all 0.8s ease; }
.picker-fade-leave-to { opacity: 0; transform: scale(1.05); }
</style>
