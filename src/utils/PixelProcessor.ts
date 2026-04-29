/**
 * PixelProcessor — 图像像素化后处理
 *  1. 最近邻缩放到目标尺寸（默认 64×64）
 *  2. 颜色量化至 24 色调色板
 *  3. 透明度硬边缘（< threshold → 全透，>= → 不透明）
 *  4. 输出 PNG data URL
 */

export interface ProcessOptions {
  size?:           number                       // 目标尺寸 px（默认 64）
  palette?:        [number, number, number][]   // 自定义调色板
  alphaThreshold?: number                       // 0-255（默认 128）
}

/** 24 色像素风调色板（PICO-8 风格扩展版）*/
export const DEFAULT_PALETTE: [number, number, number][] = [
  [  0,   0,   0], [255, 255, 255], [255,   0,   0], [  0, 255,   0],
  [  0,   0, 255], [255, 255,   0], [255,   0, 255], [  0, 255, 255],
  [128,   0,   0], [  0, 128,   0], [  0,   0, 128], [128, 128,   0],
  [128,   0, 128], [  0, 128, 128], [192, 192, 192], [128, 128, 128],
  [255, 165,   0], [165,  42,  42], [255, 192, 203], [ 75,   0, 130],
  [238, 130, 238], [ 64, 224, 208], [255, 215,   0], [ 34, 139,  34],
]

export async function processImage(
  src: string,
  opts: ProcessOptions = {}
): Promise<string> {
  const { size = 64, palette = DEFAULT_PALETTE, alphaThreshold = 128 } = opts

  const img = await loadImg(src)

  // ── Step 1: 读取原图像素 ──────────────────────────
  const srcC = document.createElement('canvas')
  srcC.width = img.width; srcC.height = img.height
  const srcCtx = srcC.getContext('2d')!
  srcCtx.drawImage(img, 0, 0)
  const srcD = srcCtx.getImageData(0, 0, img.width, img.height)

  // ── Step 2: 最近邻缩放到 size×size ───────────────
  const dstC = document.createElement('canvas')
  dstC.width = size; dstC.height = size
  const dstCtx = dstC.getContext('2d')!
  const dstD = dstCtx.createImageData(size, size)
  const sx = img.width / size, sy = img.height / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = Math.min(Math.floor(x * sx), img.width  - 1)
      const py = Math.min(Math.floor(y * sy), img.height - 1)
      const si = (py * img.width + px) * 4
      const di = (y  * size       + x)  * 4
      dstD.data[di]   = srcD.data[si]
      dstD.data[di+1] = srcD.data[si+1]
      dstD.data[di+2] = srcD.data[si+2]
      dstD.data[di+3] = srcD.data[si+3]
    }
  }

  // ── Step 3: 颜色量化 + 硬边缘 ────────────────────
  for (let i = 0; i < dstD.data.length; i += 4) {
    if (dstD.data[i+3] < alphaThreshold) {
      dstD.data[i] = dstD.data[i+1] = dstD.data[i+2] = dstD.data[i+3] = 0
    } else {
      const [r, g, b] = nearestColor(dstD.data[i], dstD.data[i+1], dstD.data[i+2], palette)
      dstD.data[i] = r; dstD.data[i+1] = g; dstD.data[i+2] = b; dstD.data[i+3] = 255
    }
  }

  dstCtx.putImageData(dstD, 0, 0)
  return dstC.toDataURL('image/png')
}

/** 返回调色板中欧氏距离最近的颜色 */
function nearestColor(
  r: number, g: number, b: number,
  palette: [number, number, number][]
): [number, number, number] {
  let minD = Infinity, nearest = palette[0]
  for (const c of palette) {
    const d = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2
    if (d < minD) { minD = d; nearest = c }
  }
  return nearest
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}
