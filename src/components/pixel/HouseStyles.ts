// ================================================================
// 像素小屋 · 四种房型像素艺术绘制引擎
// 画布基准：48×48 逻辑像素，外部可缩放
// 调色板：每种风格严格限制24色以内
// 风格参考：星露谷物语（明亮温馨、边缘干净、无抗锯齿）
// ================================================================

export type HouseStyle = 'cottage' | 'mushroom' | 'workshop' | 'oriental'

// 工具：填充逻辑像素块
function p(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: string,
  s: number = 1
) {
  ctx.fillStyle = color
  ctx.fillRect(x * s, y * s, w * s, h * s)
}

// 工具：圆形窗户（像素近似）
function circleWindow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  glass: string, frame: string, s: number
) {
  // 用像素矩形近似圆形
  const mask = [
    [0,1,1,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
  ]
  const off = r - Math.floor(r)
  const ox = cx - Math.floor(r)
  const oy = cy - Math.floor(r)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (mask[row][col]) p(ctx, ox+col, oy+row, 1, 1, glass, s)
    }
  }
  // 外框
  p(ctx, ox,   oy+1, 1, 3, frame, s)
  p(ctx, ox+4, oy+1, 1, 3, frame, s)
  p(ctx, ox+1, oy,   3, 1, frame, s)
  p(ctx, ox+1, oy+4, 3, 1, frame, s)
  // 十字格
  p(ctx, cx,   oy+1, 1, 3, frame, s)
  p(ctx, ox+1, cy,   3, 1, frame, s)
}

// ──────────────────────────────────────────────────
// 1. 田园木屋 Cottage
// 调色板（18色）：
//   天空:#c8e8f0  草1:#5aa02c  草2:#7bc148  草3:#3d7a1a
//   木墙:#c8864a  木暗:#8b5a2b  木亮:#e8a870
//   茅草:#c8a040  茅暗:#8b6a20  茅亮:#e8c870
//   烟囱:#80706a  烟囱暗:#5c4840  玻璃:#9ed8e8
//   门框:#5c3d1e  门板:#a06030  门把:#f5c518
//   栅栏:#a07040  栅暗:#7a5028
// ──────────────────────────────────────────────────
export function drawCottage(
  ctx: CanvasRenderingContext2D,
  s: number,
  frame: number = 0
) {
  ctx.imageSmoothingEnabled = false
  const W = 48, H = 48

  // 天空
  p(ctx,0,0,W,H,'#c8e8f0',s)

  // 地面草地
  p(ctx,0,40,W,8,'#3d7a1a',s)
  p(ctx,0,40,W,2,'#5aa02c',s)
  // 草地高光
  for(let x=0;x<W;x+=5) p(ctx,x,40,3,1,'#7bc148',s)

  // 木栅栏
  for(let fx=3;fx<=44;fx+=6){
    p(ctx,fx,34,2,7,'#a07040',s)
    p(ctx,fx,33,3,1,'#7a5028',s) // 帽
  }
  p(ctx,3,36,42,1,'#a07040',s)
  p(ctx,3,38,42,1,'#a07040',s)
  p(ctx,3,36,1,3,'#7a5028',s)
  p(ctx,44,36,1,3,'#7a5028',s)

  // 木板墙（带横纹）
  p(ctx,8,24,32,16,'#c8864a',s)
  for(let wy=0;wy<8;wy++) p(ctx,8,24+wy*2,32,1,'#8b5a2b',s)
  p(ctx,8,24,2,16,'#8b5a2b',s)  // 左阴影
  p(ctx,38,24,2,16,'#e8a870',s)  // 右高光

  // 烟囱（左移一点避开屋顶中轴）
  p(ctx,33,8,5,12,'#80706a',s)
  p(ctx,33,8,2,12,'#5c4840',s)
  p(ctx,32,7,7,2,'#5c4840',s) // 烟囱帽
  p(ctx,33,7,5,1,'#80706a',s)
  // 烟雾
  const smoke = 0.3 + 0.15 * Math.sin(frame * 0.15)
  ctx.fillStyle = `rgba(210,210,210,${smoke})`
  ctx.fillRect(34*s, (4 + Math.sin(frame*0.2))*s, 3*s, 3*s)
  ctx.fillStyle = `rgba(210,210,210,${smoke*0.6})`
  ctx.fillRect(35*s, (1 + Math.sin(frame*0.15))*s, 2*s, 2*s)

  // 茅草屋顶（三角形逐层）
  for(let row=0;row<16;row++){
    const hw = row + 2
    const rx = 24 - hw
    const ry = 8 + row
    if(rx < 0 || rx+hw*2 > W) continue
    p(ctx,rx,ry,hw*2,1,'#c8a040',s)
    // 左侧阴影
    p(ctx,rx,ry,2,'1','#8b6a20',s)
    // 茅草纹（每3行加亮条）
    if(row%3===0) p(ctx,rx+3,ry,4,1,'#e8c870',s)
    if(row%3===1) p(ctx,rx+hw-2,ry,3,1,'#e8c870',s)
  }
  // 屋檐线
  p(ctx,6,24,36,1,'#8b6a20',s)

  // 圆形窗户（左）
  circleWindow(ctx,15,29,2,'#9ed8e8','#5c3d1e',s)
  // 圆形窗户（右）
  circleWindow(ctx,31,29,2,'#9ed8e8','#5c3d1e',s)
  // 窗台
  p(ctx,12,32,6,1,'#8b5a2b',s)
  p(ctx,28,32,6,1,'#8b5a2b',s)

  // 门
  p(ctx,20,30,8,10,'#5c3d1e',s)
  p(ctx,21,31,6,8,'#a06030',s)
  // 门拱
  p(ctx,22,30,4,1,'#a06030',s)
  p(ctx,21,30,1,1,'#a06030',s)
  p(ctx,26,30,1,1,'#a06030',s)
  // 门板条纹
  p(ctx,21,33,6,1,'#8b5a2b',s)
  p(ctx,21,35,6,1,'#8b5a2b',s)
  // 门把手
  p(ctx,27,36,2,2,'#f5c518',s)
  // 台阶
  p(ctx,18,39,12,2,'#80706a',s)
  p(ctx,19,38,10,1,'#a09080',s)

  // 小花装饰（栅栏旁）
  p(ctx,5,39,1,1,'#e04040',s)
  p(ctx,6,38,1,1,'#e04040',s)
  p(ctx,5,38,1,1,'#60c030',s)
  p(ctx,42,39,1,1,'#ffcc00',s)
  p(ctx,43,38,1,1,'#ffcc00',s)
  p(ctx,43,39,1,1,'#60c030',s)

  // 悬挂灯（门上方，动画）
  const swing = Math.sin(frame*0.08)*2
  p(ctx,Math.round(23+swing),27,2,2,'#f5c518',s)
  ctx.fillStyle='rgba(255,220,80,0.3)'
  ctx.fillRect((Math.round(22+swing))*s,27*s,4*s,3*s)
}

// ──────────────────────────────────────────────────
// 2. 魔法蘑菇屋 Mushroom House
// 调色板（22色）：
//   夜空:#1a0a2e  星:#ffffff  地:#4a2a60  地亮:#6a3a80
//   菇帽:#e03030  帽暗:#a01010  帽亮:#ff6060
//   白点:#ffffff  点灰:#e8e8d0
//   菌茎:#f0d8b0  茎暗:#c8a870  茎亮:#f8e8c0
//   蓝门:#2060e0  门暗:#1030a0  门亮:#60a0ff  门光:#90c0ff
//   烟囱:#c06030  烟囱暗:#803020
//   小菇:#e03030  小茎:#f0d0a0  魔法:#c080ff  星光:#f0e040
// ──────────────────────────────────────────────────
export function drawMushroom(
  ctx: CanvasRenderingContext2D,
  s: number,
  frame: number = 0
) {
  ctx.imageSmoothingEnabled = false
  const W = 48, H = 48

  // 夜空背景
  p(ctx,0,0,W,H,'#1a0a2e',s)

  // 星星（随帧闪烁）
  const stars = [[3,3],[8,6],[14,2],[20,5],[28,2],[35,4],[42,1],[44,7],[6,10],[38,9],[12,8],[30,6]]
  for(const [sx,sy] of stars){
    const alpha = 0.4 + 0.4 * Math.sin(frame*0.1 + sx)
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.fillRect(sx*s, sy*s, s, s)
    if(Math.sin(frame*0.1+sx)>0.5){
      ctx.fillRect((sx-1)*s, sy*s, s, s)
      ctx.fillRect((sx+1)*s, sy*s, s, s)
      ctx.fillRect(sx*s, (sy-1)*s, s, s)
      ctx.fillRect(sx*s, (sy+1)*s, s, s)
    }
  }

  // 地面（魔法紫土）
  p(ctx,0,40,W,8,'#4a2a60',s)
  p(ctx,0,40,W,2,'#6a3a80',s)
  // 地面光斑
  for(let x=0;x<W;x+=7) p(ctx,x,40,3,1,'#8050a0',s)

  // 小蘑菇（左）
  p(ctx,3,37,3,4,'#f0d0a0',s)  // 小茎
  p(ctx,2,34,5,4,'#e03030',s)  // 小帽
  p(ctx,3,33,3,2,'#ff6060',s)  // 帽亮
  p(ctx,3,35,1,1,'#ffffff',s)  // 白点

  // 小蘑菇（右）
  p(ctx,42,38,3,3,'#f0d0a0',s)
  p(ctx,41,35,5,4,'#e03030',s)
  p(ctx,42,34,3,2,'#ff6060',s)
  p(ctx,43,36,1,1,'#ffffff',s)

  // 小蘑菇（右远）
  p(ctx,44,39,2,2,'#f0d0a0',s)
  p(ctx,43,37,4,3,'#a01010',s)
  p(ctx,44,37,2,1,'#e03030',s)

  // 菌茎主体（弯曲感：下宽上窄）
  p(ctx,12,28,24,12,'#f0d8b0',s)
  p(ctx,13,26,22,4,'#f8e8c0',s)
  p(ctx,12,28,3,12,'#c8a870',s)   // 左侧阴影
  p(ctx,33,28,3,12,'#c8a870',s)   // 右侧阴影

  // 蓝色发光大门
  const glow = 0.3 + 0.2 * Math.sin(frame * 0.12)
  ctx.fillStyle = `rgba(100,160,255,${glow})`
  ctx.fillRect(16*s, 28*s, 16*s, 12*s)
  p(ctx,18,30,12,10,'#1030a0',s)
  p(ctx,19,31,10,8,'#2060e0',s)
  // 门光泽
  p(ctx,19,31,3,8,'#60a0ff',s)
  // 门拱
  p(ctx,20,30,8,1,'#2060e0',s)
  p(ctx,19,30,1,1,'#60a0ff',s)
  p(ctx,28,30,1,1,'#2060e0',s)
  // 门把手（星形）
  p(ctx,27,35,2,2,'#f0e040',s)
  p(ctx,27,34,1,1,'#f0e040',s)
  p(ctx,28,35,1,1,'#f0e040',s)
  // 地面光效
  ctx.fillStyle = `rgba(60,100,220,${glow*0.4})`
  ctx.fillRect(16*s,38*s,16*s,3*s)

  // 蘑菇帽（大圆顶，红色带白点）
  const capRows = [
    [16,16], [11,26], [8,32],  [6,36],
    [5,38],  [5,38],  [6,36],  [8,32],
    [11,26], [14,20], [16,16]
  ]
  for(let r=0;r<11;r++){
    const [lx,w] = capRows[r]
    p(ctx,lx,8+r,w,1,'#e03030',s)
  }
  // 帽子顶部高光
  for(let r=0;r<5;r++){
    const [lx,w] = capRows[r]
    p(ctx,lx+2,8+r,Math.max(1,w-4),1,'#ff6060',s)
  }
  // 帽子阴影（下沿）
  for(let r=8;r<11;r++){
    const [lx,w] = capRows[r]
    p(ctx,lx,8+r,w,1,'#a01010',s)
  }
  // 白色圆点（随机分布）
  const dots = [[20,9,2,2],[27,10,2,2],[14,12,2,2],[24,13,2,2],[17,15,2,2],[31,12,2,2]]
  for(const [dx,dy,dw,dh] of dots){
    p(ctx,dx,dy,dw,dh,'#ffffff',s)
    p(ctx,dx,dy,1,1,'#e8e8d0',s) // 点阴影
  }

  // 弯曲烟囱（偏右，略微弯曲效果）
  p(ctx,34,12,4,8,'#c06030',s)
  p(ctx,35,10,4,4,'#c06030',s)  // 弯
  p(ctx,36,8,4,4,'#c06030',s)   // 顶端
  p(ctx,34,12,1,8,'#803020',s)  // 暗面
  p(ctx,35,10,1,4,'#803020',s)
  p(ctx,35,7,5,2,'#803020',s)   // 烟囱帽
  p(ctx,36,7,3,1,'#c06030',s)
  // 烟雾（彩色魔法烟）
  const t = frame * 0.1
  const colors = ['#c080ff','#80c0ff','#ff80c0']
  for(let i=0;i<3;i++){
    const alpha = 0.5 - i*0.1
    const ox = Math.sin(t+i)*2
    ctx.fillStyle = `rgba(${i===0?'192,128,255':i===1?'128,192,255':'255,128,192'},${alpha})`
    ctx.fillRect((36+ox)*s, (4-i*2)*s, 3*s, 2*s)
  }

  // 魔法粒子
  for(let i=0;i<5;i++){
    const px2 = 10 + Math.sin(frame*0.07+i*1.3)*18 + 14
    const py2 = 15 + Math.cos(frame*0.05+i*1.1)*8 + 5
    const alpha = 0.3 + 0.4*Math.sin(frame*0.08+i)
    ctx.fillStyle=`rgba(240,224,64,${alpha})`
    ctx.fillRect(px2*s,py2*s,s,s)
  }
}

// ──────────────────────────────────────────────────
// 3. 机械工坊 Workshop
// 调色板（20色）：
//   天:#304050  地:#2a2a30  地亮:#404048
//   金属1:#6a6a7a  金属2:#4a4a5a  金属3:#8a8a9a  金属亮:#a0a0b8
//   屋顶:#505060  顶暗:#3a3a4a  顶亮:#606070
//   齿轮:#c0a030  齿暗:#906010  齿亮:#e0c040
//   管道:#707080  管暗:#505060  管亮:#909090
//   铆钉:#b0b0c0  红灯:#ff3010  黄灯:#ffcc00  绿灯:#20cc40
// ──────────────────────────────────────────────────
export function drawWorkshop(
  ctx: CanvasRenderingContext2D,
  s: number,
  frame: number = 0
) {
  ctx.imageSmoothingEnabled = false
  const W = 48, H = 48

  // 暗夜工业天空
  p(ctx,0,0,W,H,'#304050',s)
  // 远景城市轮廓
  p(ctx,0,30,6,10,'#242434',s)
  p(ctx,0,26,4,14,'#242434',s)
  p(ctx,42,28,6,12,'#242434',s)
  p(ctx,44,24,4,16,'#242434',s)

  // 地面（金属格栅）
  p(ctx,0,40,W,8,'#2a2a30',s)
  p(ctx,0,40,W,2,'#404048',s)
  for(let x=0;x<W;x+=4) p(ctx,x,40,2,2,'#383848',s)
  for(let x=2;x<W;x+=4) p(ctx,x,42,2,2,'#484858',s)

  // 主体金属墙
  p(ctx,4,16,40,24,'#6a6a7a',s)
  // 金属板条纹（横向）
  for(let wy=0;wy<12;wy++) p(ctx,4,16+wy*2,40,1,'#4a4a5a',s)
  // 左侧暗面
  p(ctx,4,16,3,24,'#4a4a5a',s)
  // 右侧亮面
  p(ctx,41,16,3,24,'#8a8a9a',s)

  // 铆钉装饰
  const rivets = [[6,18],[6,24],[6,30],[6,36],[10,18],[42,18],[42,24],[42,30],[42,36],[38,18]]
  for(const [rx,ry] of rivets) p(ctx,rx,ry,2,2,'#b0b0c0',s)

  // 屋顶（平顶带女儿墙）
  p(ctx,2,12,44,6,'#505060',s)
  p(ctx,2,12,44,2,'#3a3a4a',s)
  p(ctx,2,17,44,1,'#606070',s)
  // 女儿墙凹凸
  for(let x=4;x<44;x+=6){
    p(ctx,x,10,4,4,'#505060',s)
    p(ctx,x,10,4,1,'#3a3a4a',s)
    p(ctx,x+4,10,2,4,'#6a6a7a',s)
  }

  // 大门（卷帘门）
  p(ctx,16,28,16,12,'#3a3a4a',s)
  for(let gy=0;gy<6;gy++) p(ctx,16,28+gy*2,16,1,'#4a4a5a',s)
  p(ctx,15,28,1,12,'#505060',s)
  p(ctx,31,28,1,12,'#505060',s)
  // 门把
  p(ctx,22,37,4,2,'#808090',s)
  p(ctx,23,36,2,4,'#606070',s)
  // 门缝高光
  p(ctx,16,28,16,1,'#606070',s)

  // 左侧窗户（方形工业窗）
  p(ctx,6,20,8,6,'#3a3a4a',s)
  p(ctx,7,21,6,4,'#405060',s)
  p(ctx,9,21,1,4,'#4a4a5a',s)  // 窗框
  p(ctx,7,23,6,1,'#4a4a5a',s)
  // 窗玻璃（带光）
  p(ctx,7,21,2,2,'#608098',s)

  // 右侧窗户
  p(ctx,34,20,8,6,'#3a3a4a',s)
  p(ctx,35,21,6,4,'#405060',s)
  p(ctx,37,21,1,4,'#4a4a5a',s)
  p(ctx,35,23,6,1,'#4a4a5a',s)
  p(ctx,35,21,2,2,'#608098',s)

  // 横向管道（穿出墙外）
  p(ctx,0,26,10,4,'#707080',s)
  p(ctx,0,26,10,1,'#909090',s)   // 管道亮面
  p(ctx,0,29,10,1,'#505060',s)   // 管道暗面
  p(ctx,9,25,3,6,'#808090',s)    // 管道接头
  // 右侧管道（排气口）
  p(ctx,38,22,10,3,'#707080',s)
  p(ctx,38,22,10,1,'#909090',s)
  p(ctx,38,24,10,1,'#505060',s)
  p(ctx,36,21,4,5,'#808090',s)  // 接头
  // 排气蒸汽
  const steamAlpha = 0.4 + 0.2*Math.sin(frame*0.2)
  ctx.fillStyle=`rgba(180,200,210,${steamAlpha})`
  ctx.fillRect(46*s, (16+Math.sin(frame*0.15))*s, 3*s, 4*s)
  ctx.fillStyle=`rgba(180,200,210,${steamAlpha*0.5})`
  ctx.fillRect(47*s, (12+Math.sin(frame*0.1))*s, 2*s, 3*s)

  // 大齿轮装饰（右侧墙）
  // 外圈
  const gearPixels = [
    [0,2],[0,3],[1,1],[1,4],[2,0],[2,5],[3,0],[3,5],
    [4,0],[4,5],[5,0],[5,5],[6,1],[6,4],[7,2],[7,3]
  ]
  for(const [gx,gy] of gearPixels){
    p(ctx,28+gx,20+gy,1,1,'#c0a030',s)
  }
  // 齿轮齿（旋转感）
  const angle = frame * 0.05
  for(let t=0;t<8;t++){
    const ga = angle + t * Math.PI/4
    const gx = Math.round(31 + Math.cos(ga)*5)
    const gy = Math.round(23 + Math.sin(ga)*5)
    if(gx>=0&&gy>=0&&gx<48&&gy<48) p(ctx,gx,gy,1,1,'#906010',s)
  }
  // 轮毂
  p(ctx,29,21,6,6,'#3a3a4a',s)
  p(ctx,30,22,4,4,'#c0a030',s)
  p(ctx,31,23,2,2,'#4a4a5a',s)

  // 小齿轮（左上）
  p(ctx,8,26,4,4,'#906010',s)
  p(ctx,9,27,2,2,'#c0a030',s)

  // 天线（右上）
  p(ctx,40,4,1,10,'#808090',s)
  p(ctx,38,10,5,1,'#808090',s)  // 横杆
  p(ctx,39,8,1,4,'#808090',s)   // 斜支撑
  p(ctx,41,8,1,4,'#808090',s)

  // 卫星锅（天线盘）
  p(ctx,36,6,7,4,'#909090',s)
  p(ctx,37,5,5,2,'#b0b0c0',s)
  p(ctx,38,5,3,1,'#c8c8d8',s)
  p(ctx,36,6,2,4,'#707080',s)   // 暗面

  // 警示灯（闪烁）
  const blink = Math.sin(frame*0.2)>0
  p(ctx,22,10,4,3,blink?'#ff3010':'#8b1a08',s)
  if(blink){
    ctx.fillStyle='rgba(255,48,16,0.4)'
    ctx.fillRect(20*s,9*s,8*s,5*s)
  }
  // 状态灯
  p(ctx,8,13,2,2,'#20cc40',s)  // 绿
  p(ctx,11,13,2,2,'#ffcc00',s) // 黄

  // 排烟管（顶部）
  p(ctx,10,8,3,10,'#606070',s)
  p(ctx,10,8,3,1,'#808090',s)
  p(ctx,9,7,5,2,'#4a4a5a',s)  // 管帽
}

// ──────────────────────────────────────────────────
// 4. 东方阁楼 Oriental
// 调色板（22色）：
//   天:#e0eef8  天亮:#f0f8ff  云:#ffffff
//   砖1:#5a7888  砖2:#3a5868  砖3:#7a9898  砖缝:#2a4050
//   瓦红:#c03030  瓦暗:#901010  瓦亮:#e05050  金边:#e0c040
//   纸窗:#f0e8c0  窗框:#704020  窗暗:#d0c090  窗光:#fff8e0
//   竹:#608030  竹暗:#406020  竹亮:#80a040  竹节:#304010
//   门红:#c02020  门金:#e0b030  地:#608050  草:#80a060
// ──────────────────────────────────────────────────
export function drawOriental(
  ctx: CanvasRenderingContext2D,
  s: number,
  frame: number = 0
) {
  ctx.imageSmoothingEnabled = false
  const W = 48, H = 48

  // 淡蓝天空
  p(ctx,0,0,W,H,'#e0eef8',s)
  p(ctx,0,0,W,12,'#f0f8ff',s)
  // 云朵（像素风）
  p(ctx,4,6,8,3,'#ffffff',s)
  p(ctx,5,5,6,1,'#ffffff',s)
  p(ctx,30,4,10,3,'#ffffff',s)
  p(ctx,32,3,6,1,'#ffffff',s)
  p(ctx,31,7,8,1,'#e8f4f8',s)  // 云底阴影

  // 地面青草
  p(ctx,0,40,W,8,'#608050',s)
  p(ctx,0,40,W,2,'#80a060',s)
  for(let x=0;x<W;x+=6) p(ctx,x,40,3,1,'#90b070',s)

  // 竹子（左侧）
  const bambooSegs = [0,4,8,12,16,20,24,28,32,36]
  for(const by of bambooSegs){
    p(ctx,2,by,3,4,'#608030',s)
    p(ctx,3,by,1,4,'#80a040',s)     // 亮面
    p(ctx,2,by,3,1,'#304010',s)     // 竹节
    // 竹叶
    if(by%8===0){
      p(ctx,0,by+1,3,1,'#608030',s)
      p(ctx,5,by+2,3,1,'#608030',s)
    }
  }
  // 竹子（右侧）
  for(const by of bambooSegs){
    p(ctx,43,by,3,4,'#608030',s)
    p(ctx,44,by,1,4,'#80a040',s)
    p(ctx,43,by,3,1,'#304010',s)
    if(by%8===4){
      p(ctx,41,by+1,3,1,'#608030',s)
      p(ctx,45,by+2,2,1,'#608030',s)
    }
  }

  // 青砖主墙
  p(ctx,7,22,34,18,'#5a7888',s)
  // 砖缝水平
  for(let wy=0;wy<9;wy++) p(ctx,7,22+wy*2,34,1,'#2a4050',s)
  // 砖缝垂直（错位）
  for(let wy=0;wy<9;wy++){
    const startX = (wy%2===0)?7:11
    for(let wx=startX;wx<41;wx+=8) p(ctx,wx,22+wy*2,1,2,'#2a4050',s)
  }
  // 墙左暗面
  p(ctx,7,22,3,18,'#3a5868',s)
  // 墙右亮面
  p(ctx,38,22,3,18,'#7a9898',s)

  // 二层屋顶（飞檐翘角，上层）
  // 主屋脊
  p(ctx,16,8,16,2,'#c03030',s)
  p(ctx,16,8,16,1,'#e05050',s)
  // 翘角瓦片（从中心向两侧）
  for(let row=0;row<8;row++){
    const hw = row * 2 + 4
    const lx = 24 - hw
    const ry = 10 + row
    if(lx<0||lx+hw*2>W) continue
    p(ctx,lx,ry,hw*2,1,'#c03030',s)
    p(ctx,lx,ry,2,1,'#e05050',s)    // 左端亮
    p(ctx,lx+hw*2-2,ry,2,1,'#901010',s) // 右端暗
    if(row%2===0) p(ctx,lx+2,ry,hw*2-4,1,'#e05050',s) // 瓦楞亮面
  }
  // 金色屋脊线
  p(ctx,15,8,18,1,'#e0c040',s)
  // 飞檐左翘角
  p(ctx,6,17,4,1,'#e05050',s)
  p(ctx,5,18,3,1,'#c03030',s)
  p(ctx,4,19,2,1,'#c03030',s)
  p(ctx,5,17,1,1,'#e0c040',s)  // 金角
  // 飞檐右翘角
  p(ctx,38,17,4,1,'#e05050',s)
  p(ctx,40,18,3,1,'#c03030',s)
  p(ctx,42,19,2,1,'#c03030',s)
  p(ctx,42,17,1,1,'#e0c040',s)

  // 一层屋顶（下层飞檐）
  for(let row=0;row<5;row++){
    const hw = row * 3 + 6
    const lx = 24 - hw
    const ry = 18 + row
    if(lx<0) continue
    p(ctx,lx,ry,hw*2,1,'#c03030',s)
    p(ctx,lx,ry,2,1,'#e05050',s)
    p(ctx,lx+hw*2-2,ry,2,1,'#901010',s)
    if(row%2===1) p(ctx,lx+2,ry,hw*2-4,1,'#e05050',s)
  }
  // 下檐金边
  p(ctx,6,22,36,1,'#e0c040',s)
  // 下檐翘角
  p(ctx,4,21,4,1,'#e05050',s)
  p(ctx,3,22,2,1,'#c03030',s)
  p(ctx,4,21,1,1,'#e0c040',s)
  p(ctx,40,21,4,1,'#e05050',s)
  p(ctx,43,22,2,1,'#c03030',s)
  p(ctx,43,21,1,1,'#e0c040',s)

  // 纸窗（左，格窗样式）
  p(ctx,9,25,10,8,'#704020',s)    // 外框
  p(ctx,10,26,8,6,'#f0e8c0',s)   // 窗纸
  p(ctx,14,26,1,6,'#704020',s)   // 中框竖
  p(ctx,10,29,8,1,'#704020',s)   // 中框横
  // 光透效果
  const glow2 = 0.3 + 0.15*Math.sin(frame*0.08)
  ctx.fillStyle=`rgba(255,240,160,${glow2})`
  ctx.fillRect(10*s,26*s,3*s,3*s)
  ctx.fillRect(15*s,30*s,3*s,2*s)

  // 纸窗（右）
  p(ctx,29,25,10,8,'#704020',s)
  p(ctx,30,26,8,6,'#f0e8c0',s)
  p(ctx,34,26,1,6,'#704020',s)
  p(ctx,30,29,8,1,'#704020',s)
  ctx.fillStyle=`rgba(255,240,160,${glow2})`
  ctx.fillRect(30*s,26*s,3*s,3*s)
  ctx.fillRect(35*s,30*s,3*s,2*s)

  // 朱红大门
  p(ctx,19,32,10,8,'#901010',s)
  p(ctx,20,33,4,6,'#c02020',s)   // 左扇门
  p(ctx,24,33,4,6,'#c02020',s)   // 右扇门
  p(ctx,23,33,2,6,'#901010',s)   // 门缝
  // 门钉（金色）
  const nails = [[21,34],[22,36],[21,38],[25,34],[26,36],[25,38]]
  for(const [nx,ny] of nails) p(ctx,nx,ny,1,1,'#e0b030',s)
  // 门框
  p(ctx,19,32,1,8,'#704020',s)
  p(ctx,28,32,1,8,'#704020',s)
  p(ctx,19,32,10,1,'#704020',s)
  // 门楣（匾额）
  p(ctx,18,30,12,3,'#c02020',s)
  p(ctx,19,31,10,1,'#e05050',s)
  p(ctx,20,31,8,1,'#e0b030',s)   // 金色匾额线
  // 台阶
  p(ctx,17,40,14,2,'#7a9898',s)
  p(ctx,18,39,12,1,'#8aa8a8',s)

  // 飞鸟（动态）
  const birdX = Math.floor(frame*0.4) % 50
  if(birdX > 0 && birdX < 45){
    p(ctx,birdX,12,2,1,'#2a4050',s)
    p(ctx,birdX-1,11,1,1,'#2a4050',s)
    p(ctx,birdX+2,11,1,1,'#2a4050',s)
  }

  // 灯笼（悬挂在屋檐下，摆动）
  const swing = Math.sin(frame*0.06)*2
  const lx2 = Math.round(13+swing)
  p(ctx,lx2,20,3,4,'#e03030',s)
  p(ctx,lx2+1,20,1,4,'#ff6060',s)
  p(ctx,lx2,19,3,1,'#e0b030',s)   // 顶
  p(ctx,lx2,23,3,1,'#e0b030',s)   // 底
  p(ctx,lx2+1,24,1,2,'#e0b030',s) // 穗子
  // 右灯笼
  const rx2 = Math.round(32-swing)
  p(ctx,rx2,20,3,4,'#e03030',s)
  p(ctx,rx2+1,20,1,4,'#ff6060',s)
  p(ctx,rx2,19,3,1,'#e0b030',s)
  p(ctx,rx2,23,3,1,'#e0b030',s)
  p(ctx,rx2+1,24,1,2,'#e0b030',s)
}

// ── 主分发函数 ─────────────────────────────────────
export function drawHouseStyle(
  ctx: CanvasRenderingContext2D,
  style: HouseStyle,
  size: number,
  frame: number = 0
) {
  const s = size / 48
  ctx.clearRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = false
  switch(style){
    case 'cottage':   drawCottage(ctx, s, frame);  break
    case 'mushroom':  drawMushroom(ctx, s, frame);  break
    case 'workshop':  drawWorkshop(ctx, s, frame); break
    case 'oriental':  drawOriental(ctx, s, frame); break
  }
}

// 元数据
export const HOUSE_STYLE_META: Record<HouseStyle, {
  name: string
  desc: string
  flavor: string
  palette: string[]
}> = {
  cottage: {
    name: '田园木屋',
    desc: '棕色木板墙 · 茅草屋顶 · 圆形窗户 · 木栅栏小院',
    flavor: '温暖宁静，最适合在傍晚记录今天的小感悟',
    palette: ['#c8864a','#c8a040','#5aa02c','#9ed8e8'],
  },
  mushroom: {
    name: '魔法蘑菇屋',
    desc: '红色蘑菇帽屋顶 · 弯曲烟囱 · 发光蓝色门 · 周围小蘑菇',
    flavor: '神秘奇幻，灵感总在意想不到的时候涌现',
    palette: ['#e03030','#2060e0','#1a0a2e','#c080ff'],
  },
  workshop: {
    name: '机械工坊',
    desc: '灰色金属壁 · 齿轮装饰 · 管道伸出墙外 · 天线卫星锅',
    flavor: '精密理性，每一条记录都是精心设计的齿轮',
    palette: ['#6a6a7a','#c0a030','#304050','#ff3010'],
  },
  oriental: {
    name: '东方阁楼',
    desc: '青砖墙 · 飞檐翘角 · 纸窗 · 竹子点缀 · 朱红大门',
    flavor: '古典雅致，如翻阅一本旧时光的书册',
    palette: ['#5a7888','#c03030','#e0c040','#608030'],
  },
}
