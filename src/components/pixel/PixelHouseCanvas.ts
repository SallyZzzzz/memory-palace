// ================================================
// 像素小屋 · Canvas 绘制引擎
// 风格参考：星露谷物语
// ================================================

export type PetState = 'idle' | 'hovered' | 'flash' | 'lonely' | 'celebrating'
export type PetStyle = 'cabin' | 'tent' | 'treehouse'
export type GrowthLevel = 1 | 2 | 3 | 4 | 5

// 像素颜色调色板（星露谷风格）
const P = {
  // 木头
  WOOD1:   '#c8864a',
  WOOD2:   '#8b5a2b',
  WOOD3:   '#e8a870',
  // 屋顶
  ROOF1:   '#c0392b',
  ROOF2:   '#922b21',
  ROOF3:   '#e74c3c',
  // 石头基础
  STONE1:  '#9e9e9e',
  STONE2:  '#616161',
  STONE3:  '#bdbdbd',
  // 窗户
  WIN_ON:  '#ffe066',
  WIN_DIM: '#4a4a6a',
  WIN_OFF: '#2c2c3a',
  WIN_FRM: '#5c3d1e',
  // 门
  DOOR1:   '#5c3d1e',
  DOOR2:   '#3e2810',
  DOOR_LT: '#ffe066',  // 门缝透光
  // 草地
  GRASS1:  '#5aa02c',
  GRASS2:  '#3d7a1a',
  GRASS3:  '#7bc148',
  // 天空/背景
  SKY:     '#87ceeb',
  // 烟囱
  CHM1:    '#616161',
  CHM2:    '#424242',
  SMOKE:   'rgba(200,200,200,',
  // 高亮/金色
  GOLD:    '#f5c518',
  WHITE:   '#ffffff',
  BLACK:   '#000000',
  TRANS:   'rgba(0,0,0,0)',
}

interface DrawContext {
  ctx: CanvasRenderingContext2D
  size: number        // 逻辑像素大小（32/48/64）
  scale: number       // 设备像素比
  state: PetState
  style: PetStyle
  level: GrowthLevel
  frame: number       // 动画帧
}

// 工具：填充像素格（按逻辑像素坐标）
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

// ── 主绘制入口 ────────────────────────────────────

export function drawHouse(dc: DrawContext) {
  const { ctx, size, state, level, frame } = dc
  ctx.clearRect(0, 0, size, size)
  
  const s = size / 32  // 缩放因子（32基准）

  if (dc.style === 'cabin') drawCabin(ctx, s, state, level, frame)
  else if (dc.style === 'tent') drawTent(ctx, s, state, level, frame)
  else drawTreehouse(ctx, s, state, level, frame)
}

// ── 小木屋（Cabin）风格 ───────────────────────────

function drawCabin(
  ctx: CanvasRenderingContext2D,
  s: number,
  state: PetState,
  level: GrowthLevel,
  frame: number
) {
  // 小院地面
  px(ctx, 0*s, 26*s, 32*s, 6*s, P.GRASS1)
  // 草地高光
  for (let i = 0; i < 32; i += 4) {
    px(ctx, i*s, 26*s, 2*s, 1*s, P.GRASS3)
  }

  // 石头基础
  px(ctx, 4*s, 20*s, 24*s, 6*s, P.STONE1)
  // 石头纹理
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const bx = (4 + c * 4) * s
      const by = (20 + r * 3) * s
      px(ctx, bx, by, 3*s, 2*s, P.STONE2)
      px(ctx, bx+1*s, by+1*s, 2*s, 1*s, P.STONE3)
    }
  }

  // 木墙主体
  px(ctx, 6*s, 10*s, 20*s, 10*s, P.WOOD1)
  // 木板纹理（横条纹）
  for (let y = 0; y < 5; y++) {
    px(ctx, 6*s, (10 + y*2)*s, 20*s, 1*s, P.WOOD2)
  }
  // 木墙高光（左侧）
  px(ctx, 6*s, 10*s, 1*s, 10*s, P.WOOD3)

  // 屋顶（三角形用矩形模拟）
  const roofColor = state === 'lonely' ? '#8b7355' : P.ROOF1
  const roofDark  = state === 'lonely' ? '#5c4a2a' : P.ROOF2
  for (let i = 0; i < 10; i++) {
    const rx = (6 + i) * s
    const rw = (20 - i * 2) * s
    if (rw <= 0) break
    px(ctx, rx, (i * 1) * s, rw, s, roofColor)
    // 屋顶阴影
    px(ctx, rx, (i) * s, 1*s, s, roofDark)
  }
  // 屋顶边缘
  px(ctx, 4*s, 10*s, 24*s, 1*s, roofDark)

  // 窗户左
  const winColor = state === 'idle' || state === 'hovered'
    ? P.WIN_ON : state === 'lonely' ? P.WIN_OFF : P.WIN_ON
  drawWindow(ctx, s, 8*s, 13*s, winColor, state, frame)
  // 窗户右
  drawWindow(ctx, s, 18*s, 13*s, winColor, state, frame)

  // 门
  drawDoor(ctx, s, 13*s, 17*s, state, frame)

  // 烟囱（Lv2+）
  if (level >= 2) {
    drawChimney(ctx, s, 22*s, 0, state, frame)
  }

  // 升级特效
  if (state === 'celebrating') {
    drawCelebrate(ctx, s, frame)
  }

  // 悬停时：整体微亮
  if (state === 'hovered') {
    ctx.fillStyle = 'rgba(255,240,100,0.08)'
    ctx.fillRect(0, 0, 32*s, 32*s)
  }

  // Flash 状态：窗户爆亮
  if (state === 'flash') {
    const alpha = 0.3 + 0.4 * Math.sin(frame * 0.8)
    ctx.fillStyle = `rgba(255,230,80,${alpha})`
    ctx.fillRect(8*s, 13*s, 6*s, 5*s)
    ctx.fillRect(18*s, 13*s, 6*s, 5*s)
  }
}

// ── 窗户 ─────────────────────────────────────────

function drawWindow(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  color: string,
  state: PetState,
  frame: number
) {
  // 外框
  px(ctx, x, y, 6*s, 5*s, P.WIN_FRM)
  // 玻璃
  px(ctx, x+s, y+s, 4*s, 3*s, color)
  // 十字格
  px(ctx, x + 3*s, y+s, s, 3*s, P.WIN_FRM)
  px(ctx, x+s, y + 2*s, 4*s, s, P.WIN_FRM)
  // 高光点
  if (state !== 'lonely') {
    px(ctx, x + s, y + s, s, s, P.WHITE)
  }
  // 悬停闪烁
  if (state === 'hovered') {
    const glow = 0.2 + 0.15 * Math.sin(frame * 0.3)
    ctx.fillStyle = `rgba(255,240,100,${glow})`
    ctx.fillRect(x+s, y+s, 4*s, 3*s)
  }
}

// ── 门 ───────────────────────────────────────────

function drawDoor(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  state: PetState,
  frame: number
) {
  // 门框
  px(ctx, x, y, 6*s, 9*s, P.DOOR2)
  // 门面板
  px(ctx, x+s, y+s, 4*s, 7*s, P.DOOR1)
  // 门把手
  px(ctx, x + 4*s, y + 5*s, s, s, P.GOLD)
  
  // 悬停：门缝透光
  if (state === 'hovered') {
    const alpha = 0.4 + 0.3 * Math.sin(frame * 0.5)
    // 左缝
    ctx.fillStyle = `rgba(255,230,80,${alpha})`
    ctx.fillRect(x+s, y+s, s, 7*s)
    // 底缝
    ctx.fillRect(x+s, y + 7*s, 4*s, s)
  }
}

// ── 烟囱 ─────────────────────────────────────────

function drawChimney(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  state: PetState,
  frame: number
) {
  // 烟囱主体
  px(ctx, x, y + 2*s, 4*s, 6*s, P.CHM1)
  px(ctx, x, y + 2*s, s, 6*s, P.CHM2)
  // 烟囱帽
  px(ctx, x - s, y + s, 6*s, s, P.CHM2)

  // 烟雾（悬停时冒烟）
  if (state === 'hovered' || state === 'idle') {
    const t = frame * 0.15
    for (let i = 0; i < 3; i++) {
      const sy = y - i * 3*s + (t % (3*s))
      const sx = x + s + Math.sin(t + i) * s
      const alpha = Math.max(0, 0.5 - i * 0.15)
      ctx.fillStyle = `${P.SMOKE}${alpha})`
      ctx.fillRect(sx, sy, 2*s, 2*s)
    }
  }
}

// ── 庆祝特效 ─────────────────────────────────────

function drawCelebrate(
  ctx: CanvasRenderingContext2D,
  s: number,
  frame: number
) {
  const colors = [P.GOLD, '#e74c3c', '#3498db', '#2ecc71', '#9b59b6']
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + frame * 0.1
    const r = (6 + Math.sin(frame * 0.2 + i) * 2) * s
    const cx = 16*s + Math.cos(angle) * r
    const cy = 12*s + Math.sin(angle) * r * 0.6
    ctx.fillStyle = colors[i % colors.length]
    ctx.fillRect(cx, cy, 2*s, 2*s)
  }
  // 金光效果
  ctx.fillStyle = `rgba(255,213,0,${0.1 + 0.1 * Math.sin(frame * 0.3)})`
  ctx.fillRect(4*s, 0, 24*s, 26*s)
}

// ── 帐篷（Tent）风格 ──────────────────────────────

function drawTent(
  ctx: CanvasRenderingContext2D,
  s: number,
  state: PetState,
  level: GrowthLevel,
  frame: number
) {
  // 地面
  px(ctx, 0, 25*s, 32*s, 7*s, P.GRASS1)

  // 帐篷主体（三角形）
  for (let i = 0; i < 14; i++) {
    const tx = (2 + i) * s
    const tw = (28 - i * 2) * s
    if (tw <= 0) break
    const c = i < 7 ? '#e67e22' : '#d35400'
    px(ctx, tx, (4 + i) * s, tw, s, c)
  }
  // 帐篷边线
  for (let i = 0; i < 14; i++) {
    px(ctx, (2 + i)*s, (4 + i)*s, s, s, '#a04000')
    px(ctx, (30 - i)*s, (4 + i)*s, s, s, '#a04000')
  }

  // 帐篷门
  const flap = state === 'hovered' ? 2 : 0
  px(ctx, 12*s, 18*s, 8*s, 7*s, '#8b4513')
  px(ctx, (12 + flap)*s, 18*s, (8 - flap*2)*s, 7*s, '#6b3410')

  // 帐篷顶旗
  px(ctx, 15*s, 2*s, 2*s, 4*s, '#888')
  px(ctx, 17*s, 2*s, 4*s, 3*s, P.GOLD)

  if (state === 'celebrating') drawCelebrate(ctx, s, frame)
}

// ── 树屋（Treehouse）风格 ─────────────────────────

function drawTreehouse(
  ctx: CanvasRenderingContext2D,
  s: number,
  state: PetState,
  level: GrowthLevel,
  frame: number
) {
  // 地面
  px(ctx, 0, 26*s, 32*s, 6*s, P.GRASS1)

  // 树干
  px(ctx, 12*s, 16*s, 8*s, 12*s, '#5c3d1e')
  px(ctx, 12*s, 16*s, 2*s, 12*s, '#7a5230')
  // 树根
  px(ctx, 10*s, 25*s, 3*s, 1*s, '#3e2810')
  px(ctx, 19*s, 25*s, 3*s, 1*s, '#3e2810')

  // 树叶（大圆圈用方块模拟）
  const leafColor = state === 'lonely' ? '#4a7c1a' : '#5aa02c'
  const leafLight = state === 'lonely' ? '#3d6614' : P.GRASS3
  // 中间圆形叶子
  const leafMap = [
    [8,6,16,4],  [6,8,20,4],  [4,10,24,4],
    [4,12,24,4], [6,14,20,2], [8,15,16,1],
  ]
  for (const [lx,ly,lw,lh] of leafMap) {
    px(ctx, lx*s, ly*s, lw*s, lh*s, leafColor)
  }
  // 叶子高光
  px(ctx, 10*s, 8*s, 4*s, 2*s, leafLight)
  px(ctx, 18*s, 10*s, 3*s, 2*s, leafLight)

  // 小屋平台
  px(ctx, 8*s, 14*s, 16*s, 2*s, P.WOOD2)

  // 小屋主体
  px(ctx, 9*s, 8*s, 14*s, 7*s, P.WOOD1)
  for (let y = 0; y < 3; y++) {
    px(ctx, 9*s, (8 + y*2)*s, 14*s, s, P.WOOD2)
  }

  // 三角屋顶
  for (let i = 0; i < 5; i++) {
    px(ctx, (9+i)*s, (3+i)*s, (14-i*2)*s, s, P.ROOF1)
  }

  // 窗户
  const wc = state === 'lonely' ? P.WIN_OFF : P.WIN_ON
  drawWindow(ctx, s, 10*s, 9*s, wc, state, frame)
  drawWindow(ctx, s, 17*s, 9*s, wc, state, frame)

  // 小门
  px(ctx, 14*s, 10*s, 4*s, 5*s, P.DOOR1)
  px(ctx, 15*s, 12*s, s, s, P.GOLD)

  // 梯子
  for (let i = 0; i < 4; i++) {
    px(ctx, 14*s, (16 + i*2)*s, s, s, P.WOOD2)
    px(ctx, 17*s, (16 + i*2)*s, s, s, P.WOOD2)
    px(ctx, 14*s, (15 + i*2)*s, 4*s, s, P.WOOD1)
  }

  if (state === 'celebrating') drawCelebrate(ctx, s, frame)
}
