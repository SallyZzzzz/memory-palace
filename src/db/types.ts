// ================================================
// 像素小屋 · 数据类型定义
// ================================================

export type ZoneId = 'garden' | 'store' | 'lounge' | 'study' | 'lab' | 'cellar'

export type EntryType = 'idea' | 'resource' | 'note' | 'doc' | 'relation'

export interface Entry {
  id: string
  zone: ZoneId
  title: string
  content: string
  entryType: EntryType
  tags: string[]
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  meta: EntryMeta
}

export interface EntryMeta {
  url?: string
  filePath?: string
  mimeType?: string
  thumbnail?: string
  x?: number
  y?: number
  color?: string
  wordCount?: number
  versions?: DocVersion[]
  coverEmoji?: string
  // 仓库分类
  category?: string
  note?: string
  fileSize?: number
  // 储藏室附件
  files?: string[]
  [key: string]: unknown   // 允许任意扩展字段，避免未来类型报错
}

export interface DocVersion {
  savedAt: number
  content: string
}

export interface Relation {
  id: string
  sourceId: string
  targetId: string
  relType: 'manual' | 'auto' | 'merged'
  label: string
  strength: number
  createdAt: number
}

export interface AppSettings {
  petPosition: { x: number; y: number }
  petSize: 32 | 48 | 64
  petStyle: 'cabin' | 'tent' | 'treehouse'
  zoneNames: Record<ZoneId, string>
  butlerSkin: ButlerSkin
  dataPath: string
  language: 'zh' | 'en'
  lastActiveAt: number
}

export interface ButlerSkin {
  hairStyle: number
  hairColor: string
  clothColor: string
  eyeStyle: number
  mouthStyle: number
  customSprite?: string
}

export type PetState = 'idle' | 'hovered' | 'flash' | 'lonely' | 'celebrating'

export interface GrowthStage {
  level: number
  name: string
  minEntries: number
  minRelations: number
  unlocks: string[]
}

export const GROWTH_STAGES: GrowthStage[] = [
  { level: 1, name: '初生小屋', minEntries: 0,   minRelations: 0,  unlocks: ['base'] },
  { level: 2, name: '温馨木屋', minEntries: 10,  minRelations: 0,  unlocks: ['chimney'] },
  { level: 3, name: '欢乐农庄', minEntries: 30,  minRelations: 3,  unlocks: ['windmill', 'yard'] },
  { level: 4, name: '宏伟塔楼', minEntries: 80,  minRelations: 10, unlocks: ['tower', 'flags'] },
  { level: 5, name: '魔法城堡', minEntries: 200, minRelations: 30, unlocks: ['crystal', 'starfield', 'roof'] },
]

export const DEFAULT_ZONE_NAMES: Record<ZoneId, string> = {
  garden: '花园',
  store:  '仓库',
  lounge: '客厅',
  study:  '书房',
  lab:    '工坊',
  cellar: '地下室',
}

export const ZONE_ICONS: Record<ZoneId, string> = {
  garden: '🌷',
  store:  '📦',
  lounge: '🛋️',
  study:  '📚',
  lab:    '🔬',
  cellar: '🕳️',
}

export const ZONE_COLORS: Record<ZoneId, string> = {
  garden: '#5aa02c',
  store:  '#c8864a',
  lounge: '#6b8dd6',
  study:  '#9b59b6',
  lab:    '#e67e22',
  cellar: '#7f8c8d',
}
