// ================================================
// 像素小屋 · 本地数据访问层
// 当前：LocalStorage（开发阶段）
// 生产：替换为 Tauri SQLite plugin
// ================================================

import type { Entry, Relation, AppSettings, ZoneId } from './types'
import { DEFAULT_ZONE_NAMES } from './types'

const KEYS = {
  ENTRIES: 'ph_entries',
  RELATIONS: 'ph_relations',
  SETTINGS: 'ph_settings',
  GROWTH: 'ph_growth',
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Entries ──────────────────────────────────────

export function getAllEntries(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.ENTRIES) || '[]')
  } catch {
    return []
  }
}

export function getEntriesByZone(zone: ZoneId): Entry[] {
  return getAllEntries().filter(e => e.zone === zone && e.deletedAt === null)
}

export function getDeletedEntries(): Entry[] {
  return getAllEntries().filter(e => e.deletedAt !== null)
}

export function createEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Entry {
  const entry: Entry = {
    ...data,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  }
  const all = getAllEntries()
  all.push(entry)
  localStorage.setItem(KEYS.ENTRIES, JSON.stringify(all))
  return entry
}

export function updateEntry(id: string, data: Partial<Entry>): Entry | null {
  const all = getAllEntries()
  const idx = all.findIndex(e => e.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...data, updatedAt: Date.now() }
  localStorage.setItem(KEYS.ENTRIES, JSON.stringify(all))
  return all[idx]
}

export function softDeleteEntry(id: string): void {
  updateEntry(id, { deletedAt: Date.now() })
}

export function restoreEntry(id: string): void {
  updateEntry(id, { deletedAt: null })
}

export function permanentDeleteEntry(id: string): void {
  const all = getAllEntries().filter(e => e.id !== id)
  localStorage.setItem(KEYS.ENTRIES, JSON.stringify(all))
  // 同时删除关联
  const relations = getAllRelations().filter(r => r.sourceId !== id && r.targetId !== id)
  localStorage.setItem(KEYS.RELATIONS, JSON.stringify(relations))
}

export function clearCellar(): void {
  const active = getAllEntries().filter(e => e.deletedAt === null)
  localStorage.setItem(KEYS.ENTRIES, JSON.stringify(active))
}

export function searchEntries(keyword: string): Entry[] {
  const kw = keyword.toLowerCase()
  return getAllEntries().filter(e =>
    e.deletedAt === null && (
      e.title.toLowerCase().includes(kw) ||
      e.content.toLowerCase().includes(kw) ||
      e.tags.some(t => t.toLowerCase().includes(kw))
    )
  )
}

// ── Relations ────────────────────────────────────

export function getAllRelations(): Relation[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.RELATIONS) || '[]')
  } catch {
    return []
  }
}

export function getRelationsByEntry(entryId: string): Relation[] {
  return getAllRelations().filter(r => r.sourceId === entryId || r.targetId === entryId)
}

export function createRelation(data: Omit<Relation, 'id' | 'createdAt'>): Relation {
  const relation: Relation = {
    ...data,
    id: generateId(),
    createdAt: Date.now(),
  }
  const all = getAllRelations()
  all.push(relation)
  localStorage.setItem(KEYS.RELATIONS, JSON.stringify(all))
  return relation
}

export function deleteRelation(id: string): void {
  const all = getAllRelations().filter(r => r.id !== id)
  localStorage.setItem(KEYS.RELATIONS, JSON.stringify(all))
}

// ── Settings ─────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  petPosition: { x: 100, y: 100 },
  petSize: 64,
  petStyle: 'cabin',
  zoneNames: DEFAULT_ZONE_NAMES,
  butlerSkin: {
    hairStyle: 0,
    hairColor: '#8b6340',
    clothColor: '#6b8dd6',
    eyeStyle: 0,
    mouthStyle: 0,
  },
  dataPath: '',
  language: 'zh',
  lastActiveAt: Date.now(),
}

export function getSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.SETTINGS) || 'null')
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = getSettings()
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }))
}

// ── Stats ─────────────────────────────────────────

export function getStats() {
  const entries = getAllEntries().filter(e => e.deletedAt === null)
  const relations = getAllRelations()
  return {
    totalEntries: entries.length,
    totalRelations: relations.length,
    byZone: {
      garden: entries.filter(e => e.zone === 'garden').length,
      store:  entries.filter(e => e.zone === 'store').length,
      lounge: entries.filter(e => e.zone === 'lounge').length,
      study:  entries.filter(e => e.zone === 'study').length,
      lab:    entries.filter(e => e.zone === 'lab').length,
      cellar: entries.filter(e => e.deletedAt !== null).length,
    }
  }
}
