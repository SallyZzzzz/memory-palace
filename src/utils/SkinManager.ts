/**
 * SkinManager — 皮肤加载 / 保存 / 重置 / API 调用
 *
 * 皮肤以 PNG base64 data URL 存储在 localStorage（key: ph_custom_skins）。
 * 格式：{ garden: "data:image/png;base64,…", study: "…", … }
 */

import { processImage } from './PixelProcessor'
import type { ProcessOptions } from './PixelProcessor'

export type ZoneId = 'garden' | 'study' | 'lounge' | 'store' | 'lab' | 'cellar'

export interface ImageApiConfig {
  provider: 'dalle' | 'sdwebui' | 'replicate' | 'custom'
  apiKey:   string
  apiUrl:   string   // base URL（provider 有默认值时可留空）
  model:    string
}

const STORAGE_KEY = 'ph_custom_skins'

function load(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function save(store: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** 获取某区域自定义皮肤（data URL），无则返回 null */
export function getSkin(zone: ZoneId): string | null {
  return load()[zone] ?? null
}

/** 保存皮肤 data URL */
export function setSkin(zone: ZoneId, dataUrl: string) {
  const s = load(); s[zone] = dataUrl; save(s)
}

/** 删除某区域自定义皮肤 */
export function resetSkin(zone: ZoneId) {
  const s = load(); delete s[zone]; save(s)
}

/** 删除所有自定义皮肤 */
export function resetAllSkins() {
  localStorage.removeItem(STORAGE_KEY)
}

/** 获取全部已有自定义皮肤 */
export function getAllSkins(): Record<string, string> {
  return load()
}

// ─────────────────────────────────────────────────────────
//  AI 生成 + 后处理
// ─────────────────────────────────────────────────────────

/**
 * 调用图像生成 API → 返回原始图 URL/dataURL
 * → 传入 PixelProcessor → 返回 64×64 像素化 PNG data URL
 */
export async function generateSkin(
  prompt:  string,
  api:     ImageApiConfig,
  procOpts?: ProcessOptions
): Promise<{ raw: string; processed: string }> {
  const raw = await callApi(prompt, api)
  const processed = await processImage(raw, { size: 64, ...procOpts })
  return { raw, processed }
}

// ── 各 provider 的 API 调用实现 ──────────────────────────

async function callApi(prompt: string, cfg: ImageApiConfig): Promise<string> {
  switch (cfg.provider) {

    // ── DALL-E（OpenAI）──────────────────────────────────
    case 'dalle': {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model:           cfg.model || 'dall-e-3',
          n:               1,
          size:            '1024x1024',
          response_format: 'b64_json',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `DALL-E Error ${res.status}`)
      return `data:image/png;base64,${data.data[0].b64_json}`
    }

    // ── Stable Diffusion WebUI（本地/远程）──────────────
    case 'sdwebui': {
      const base = (cfg.apiUrl || 'http://localhost:7860').replace(/\/$/, '')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`
      const res = await fetch(`${base}/sdapi/v1/txt2img`, {
        method: 'POST', headers,
        body: JSON.stringify({
          prompt,
          width: 512, height: 512,
          steps: 20,
          sampler_name: 'Euler a',
          cfg_scale: 7,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`SD WebUI Error ${res.status}`)
      return `data:image/png;base64,${data.images[0]}`
    }

    // ── Replicate（轮询）──────────────────────────────────
    case 'replicate': {
      const createRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Token ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: cfg.model, input: { prompt } }),
      })
      const pred = await createRes.json()
      if (!createRes.ok) throw new Error(pred.detail ?? `Replicate Error ${createRes.status}`)

      // 轮询最多 120 秒
      for (let i = 0; i < 60; i++) {
        await sleep(2000)
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
          headers: { 'Authorization': `Token ${cfg.apiKey}` },
        })
        const p = await pollRes.json()
        if (p.status === 'succeeded') return Array.isArray(p.output) ? p.output[0] : p.output
        if (p.status === 'failed')    throw new Error(`Replicate 生成失败: ${p.error}`)
      }
      throw new Error('Replicate 超时（超过 120s）')
    }

    // ── 自定义 OpenAI-compat 接口 ─────────────────────────
    case 'custom': {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`
      const res = await fetch(cfg.apiUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ prompt, model: cfg.model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Custom API Error ${res.status}`)
      // 兼容多种响应格式
      if (data.data?.[0]?.b64_json)  return `data:image/png;base64,${data.data[0].b64_json}`
      if (data.data?.[0]?.url)        return data.data[0].url
      if (data.images?.[0])           return `data:image/png;base64,${data.images[0]}`
      if (data.output?.[0])           return data.output[0]
      if (data.url)                   return data.url
      throw new Error('无法解析 API 响应，请检查格式')
    }

    default:
      throw new Error(`不支持的提供商: ${cfg.provider}`)
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
