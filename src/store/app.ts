// ================================================
// 像素小屋 · 全局应用状态
// ================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSettings, saveSettings, getStats } from '@/db'
import type { AppSettings, PetState, ZoneId } from '@/db/types'
import { GROWTH_STAGES } from '@/db/types'

export const useAppStore = defineStore('app', () => {
  // 设置
  const settings = ref<AppSettings>(getSettings())
  
  // 桌宠状态
  const petState = ref<PetState>('idle')
  const petStateTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  
  // 主窗口
  const isMainWindowOpen = ref(false)
  const activeZone = ref<ZoneId | null>(null)
  
  // 管家气泡
  const butlerMessage = ref('')
  const butlerVisible = ref(false)
  
  // 全局搜索
  const searchVisible = ref(false)
  const searchKeyword = ref('')

  // 设置弹窗
  const showSettings = ref(false)

  // 猫咪聊天面板
  const showCatChat = ref(false)

  // 皮肤版本号：每次应用/重置皮肤后 +1，PixelHouse watch 到后重新加载
  const skinVersion = ref(0)

  // 图像 API 配置（运行时缓存，不持久化，在 SkinStudio 内保存）
  const imgApiConfig = ref<any>(null)

  // LLM 配置（持久化到 localStorage）
  const LLM_KEY = 'ph_llm_config'
  function loadLlmConfig() {
    try { return JSON.parse(localStorage.getItem(LLM_KEY) || '{}') } catch { return {} }
  }
  const llmConfig = ref<{
    provider: string; apiKey: string; model: string; baseUrl: string
  }>({
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: '',
    ...loadLlmConfig(),
  })
  function saveLlmConfig() {
    localStorage.setItem(LLM_KEY, JSON.stringify(llmConfig.value))
  }

  // 云同步配置
  const SYNC_KEY = 'ph_sync_config'
  function loadSyncConfig() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') } catch { return {} }
  }
  const syncConfig = ref<{
    enabled: boolean; type: string; url: string; username: string; password: string
  }>({
    enabled: false, type: 'webdav', url: '', username: '', password: '',
    ...loadSyncConfig(),
  })
  function saveSyncConfig() {
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig.value))
  }
  
  // 成长状态
  const stats = ref(getStats())
  
  const currentLevel = computed(() => {
    const level = [...GROWTH_STAGES]
      .reverse()
      .find(s => stats.value.totalEntries >= s.minEntries && stats.value.totalRelations >= s.minRelations)
    return level ?? GROWTH_STAGES[0]
  })
  
  const nextLevel = computed(() => {
    const idx = GROWTH_STAGES.findIndex(s => s.level === currentLevel.value.level)
    return idx < GROWTH_STAGES.length - 1 ? GROWTH_STAGES[idx + 1] : null
  })

  // 区域名称（支持自定义）
  function getZoneName(zone: ZoneId): string {
    return settings.value.zoneNames[zone]
  }

  // 切换桌宠状态（带自动复原）
  function setPetState(state: PetState, duration?: number) {
    if (petStateTimer.value) clearTimeout(petStateTimer.value)
    petState.value = state
    if (duration) {
      petStateTimer.value = setTimeout(() => {
        petState.value = 'idle'
      }, duration)
    }
  }

  // 显示管家气泡消息
  function showButlerMessage(msg: string, duration = 4000) {
    butlerMessage.value = msg
    butlerVisible.value = true
    setTimeout(() => {
      butlerVisible.value = false
    }, duration)
  }

  // 保存设置
  function updateSettings(data: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...data }
    saveSettings(data)
  }

  // 刷新统计（内容变更后调用）
  function refreshStats() {
    stats.value = getStats()
  }

  // 打开区域
  function openZone(zone: ZoneId) {
    activeZone.value = zone
    isMainWindowOpen.value = true
  }

  return {
    settings,
    petState,
    isMainWindowOpen,
    activeZone,
    butlerMessage,
    butlerVisible,
    searchVisible,
    searchKeyword,
    showSettings,
    showCatChat,
    skinVersion,
    imgApiConfig,
    llmConfig,
    saveLlmConfig,
    syncConfig,
    saveSyncConfig,
    stats,
    currentLevel,
    nextLevel,
    getZoneName,
    setPetState,
    showButlerMessage,
    updateSettings,
    refreshStats,
    openZone,
  }
})
