<template>
  <div class="castle-view" @dragover.prevent @drop.prevent="onGlobalDrop">
    <div class="castle-header">
      <div class="castle-title">
        <span>🏰</span>
        <span>{{ appStore.currentLevel.name }}</span>
        <span class="lv-badge">Lv.{{ appStore.currentLevel.level }}</span>
      </div>
      <div class="castle-controls">
        <button class="ctrl-btn" @click="appStore.searchVisible = true">🔍</button>
        <button class="ctrl-btn" @click="showGrowth = !showGrowth">📊 {{ appStore.stats.totalEntries }}条</button>
        <button class="ctrl-btn ctrl-green" @click="appStore.isMainWindowOpen = false">← 桌面</button>
        <button class="ctrl-btn ctrl-red" @click="appStore.isMainWindowOpen = false">✕</button>
      </div>
    </div>
    <div class="scene-wrap">
      <canvas ref="bgCanvas" class="scene-canvas" />
      <div v-for="zone in ZONES" :key="zone.id" class="zone-spot" :style="zone.pos"
        :class="{ over: dragOverZone === zone.id }"
        @click="openZone(zone.id)"
        @contextmenu.prevent="openMenu($event, zone.id)"
        @dragover.prevent="dragOverZone = zone.id"
        @dragleave="dragOverZone = null"
        @drop.prevent="onZoneDrop($event, zone.id)">
        <div class="zone-label">
          <span>{{ zone.icon }}</span>
          <span>{{ zone.name }}</span>
          <span v-if="roomCount(zone.id)" class="cnt">{{ roomCount(zone.id) }}</span>
        </div>
        <div v-if="dragOverZone === zone.id" class="drop-badge">放入 {{ zone.name }}</div>
      </div>
    </div>
    <Teleport to="body">
      <template v-if="ctxMenu.visible">
        <div class="ctx-bg" @click="ctxMenu.visible = false" />
        <div class="ctx-box" :style="{ left: ctxMenu.x+'px', top: ctxMenu.y+'px' }">
          <div class="ctx-head">{{ activeZone?.icon }} {{ activeZone?.name }}</div>
          <hr class="ctx-hr" />
          <button class="ctx-row" @click="openQuick('idea')">✨ 新建想法</button>
          <button class="ctx-row" @click="openQuick('note')">📝 新建便签</button>
          <button class="ctx-row" @click="openQuick('doc')">📄 新建文档</button>
          <button class="ctx-row" @click="openQuick('resource')">📁 导入文件</button>
          <hr class="ctx-hr" />
          <button class="ctx-row ctx-primary" @click="openZone(ctxMenu.zoneId)">🚪 进入房间</button>
        </div>
      </template>
      <div v-if="qa.visible" class="qa-overlay" @click.self="qa.visible = false">
        <div class="qa-box">
          <div class="qa-head">
            {{ activeZone?.icon }} 添加到「{{ activeZone?.name }}」
            <button class="x-btn" @click="qa.visible = false">✕</button>
          </div>
          <input ref="qaTitleRef" v-model="qa.title" class="px-input" placeholder="标题（可选）" @keydown.enter="qaBodyRef?.focus()" />
          <textarea ref="qaBodyRef" v-model="qa.body" class="px-input px-ta" rows="4" placeholder="内容…" @keydown.ctrl.enter="submitQA" />
          <div class="drop-zone" :class="{ active: fileHover }"
            @dragover.prevent="fileHover = true" @dragleave="fileHover = false" @drop.prevent="onFileDrop">
            <span v-if="!qa.files.length">📎 拖放文件，或 <span class="link" @click="fileRef?.click()">点击选择</span></span>
            <div v-else class="file-chips">
              <span v-for="f in qa.files" :key="f.name" class="chip">📄 {{ f.name }}</span>
            </div>
          </div>
          <input ref="fileRef" type="file" multiple style="display:none" @change="onFileSelect" />
          <div class="qa-foot"><button class="px-btn" @click="submitQA">💾 保存</button></div>
        </div>
      </div>
    </Teleport>
    <Transition name="grow">
      <div v-if="showGrowth" class="growth-box">
        <div class="growth-head">📊 小屋成长 <button class="x-btn" @click="showGrowth = false">✕</button></div>
        <div v-for="s in GROWTH_STAGES" :key="s.level" class="stage-row"
          :class="{ done: s.level <= appStore.currentLevel.level, cur: s.level === appStore.currentLevel.level }">
          {{ s.level <= appStore.currentLevel.level ? '⭐' : '☆' }}
          <div><div>Lv.{{ s.level }} {{ s.name }}</div><div class="stage-sub">{{ s.minEntries }}条</div></div>
        </div>
        <div class="prog-label">{{ appStore.stats.totalEntries }} / {{ appStore.nextLevel?.minEntries ?? '∞' }}</div>
        <div class="prog-bar"><div class="prog-fill" :style="{ width: pct + '%' }" /></div>
      </div>
    </Transition>
    <GlobalSearch v-if="appStore.searchVisible" @close="appStore.searchVisible = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppStore } from '@/store/app'
import { GROWTH_STAGES } from '@/db/types'
import { createEntry, getAllEntries } from '@/db'
import type { ZoneId } from '@/db/types'
import GlobalSearch from '@/components/GlobalSearch.vue'

const appStore = useAppStore()
const bgCanvas = ref<HTMLCanvasElement>()
const showGrowth = ref(false)
const qaTitleRef = ref<HTMLInputElement>()
const qaBodyRef = ref<HTMLTextAreaElement>()
const fileRef = ref<HTMLInputElement>()
const fileHover = ref(false)
const dragOverZone = ref<ZoneId | null>(null)

const ZONES = [
  { id: 'garden' as ZoneId, icon: '🌱', name: '花园',   pos: { left:'5%',  bottom:'28%', width:'18%' } },
  { id: 'study'  as ZoneId, icon: '📚', name: '书房',   pos: { left:'24%', bottom:'36%', width:'16%' } },
  { id: 'lounge' as ZoneId, icon: '🎨', name: '客厅',   pos: { left:'41%', bottom:'40%', width:'16%' } },
  { id: 'lab'    as ZoneId, icon: '🔬', name: '实验室', pos: { left:'58%', bottom:'36%', width:'16%' } },
  { id: 'store'  as ZoneId, icon: '📦', name: '仓库',   pos: { left:'75%', bottom:'28%', width:'16%' } },
  { id: 'cellar' as ZoneId, icon: '🗝️', name: '地窖',  pos: { left:'46%', bottom:'14%', width:'12%' } },
]

function roomCount(id: ZoneId) {
  const n = getAllEntries(id).length; return n ? `${n}条` : ''
}

const ctxMenu = reactive({ visible: false, x: 0, y: 0, zoneId: null as ZoneId | null })
const activeZone = computed(() => ZONES.find(z => z.id === ctxMenu.zoneId))

function openMenu(e: MouseEvent, id: ZoneId) {
  ctxMenu.x = Math.min(e.clientX, window.innerWidth - 175)
  ctxMenu.y = Math.min(e.clientY, window.innerHeight - 230)
  ctxMenu.zoneId = id; ctxMenu.visible = true
}
function openZone(id: ZoneId | null) {
  if (!id) return; ctxMenu.visible = false; appStore.openZone(id)
}

const qa = reactive({ visible: false, title: '', body: '', type: 'idea' as string, files: [] as File[] })

function openQuick(type: string) {
  ctxMenu.visible = false
  Object.assign(qa, { title: '', body: '', type, files: [], visible: true })
  nextTick(() => qaTitleRef.value?.focus())
}
function submitQA() {
  if (!qa.title && !qa.body && !qa.files.length) return
  createEntry({ zone: ctxMenu.zoneId ?? 'garden', title: qa.title || qa.files[0]?.name || '未命名',
    content: qa.body, entryType: qa.type as any, tags: [], meta: { files: qa.files.map(f => f.name) } })
  appStore.refreshStats(); qa.visible = false
}
function onFileDrop(e: DragEvent) { fileHover.value = false; qa.files.push(...Array.from(e.dataTransfer?.files ?? [])) }
function onFileSelect(e: Event) { qa.files.push(...Array.from((e.target as HTMLInputElement).files ?? [])) }
function onGlobalDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files ?? []); if (!files.length) return
  ctxMenu.zoneId = 'store'; Object.assign(qa, { files, title: files[0].name, body: '', type: 'resource', visible: true })
}
function onZoneDrop(e: DragEvent, id: ZoneId) {
  dragOverZone.value = null
  const files = Array.from(e.dataTransfer?.files ?? []); if (!files.length) return
  ctxMenu.zoneId = id; Object.assign(qa, { files, title: files[0].name, body: '', type: 'resource', visible: true })
}

const pct = computed(() => {
  const next = appStore.nextLevel; if (!next) return 100
  const cur = appStore.currentLevel
  return Math.min(100, Math.round((appStore.stats.totalEntries - cur.minEntries) / (next.minEntries - cur.minEntries) * 100))
})

let raf = 0, fc = 0

function draw() {
  const canvas = bgCanvas.value; if (!canvas) return
  const W = canvas.offsetWidth || 900, H = canvas.offsetHeight || 540
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const P = Math.max(2, Math.floor(Math.min(W, H) / 90))
  const r = (x:number,y:number,w:number,h:number,c:string) => { ctx.fillStyle=c; ctx.fillRect(x*P,y*P,w*P,h*P) }
  const TW = Math.floor(W/P), TH = Math.floor(H/P)

  // 天空
  const sky = ctx.createLinearGradient(0,0,0,H*0.65)
  sky.addColorStop(0,'#0b0820'); sky.addColorStop(0.5,'#1a1040'); sky.addColorStop(1,'#3d1a5a')
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H*0.65)
  // 地面
  const gndY = Math.floor(TH*0.65)
  r(0,gndY,TW,TH-gndY,'#1a3010'); r(0,gndY+6,TW,TH-gndY-6,'#2a1a0a')
  for (let gx=0;gx<TW;gx+=3) { r(gx,gndY,2,1,'#2a5020'); r(gx+1,gndY-1,1,2,'#30a040') }
  // 星星
  [[4,2],[12,4],[20,1],[28,3],[36,2],[44,5],[54,2],[62,4],[70,1],[78,3],
   [8,7],[24,6],[46,8],[64,6],[80,4],[16,9],[38,7],[56,5],[72,8],[88,3]].forEach(([sx,sy]) => {
    ctx.fillStyle=((sx+sy)%3===0)?'#ffffff':'#c0d0ff'; ctx.fillRect(sx*P,sy*P,P,P)
  })
  // 月亮
  r(TW-12,2,6,6,'#f0e8a0'); r(TW-11,1,4,1,'#f0e8a0'); r(TW-10,2,2,2,'#0b0820')
  // 流云
  const cx2=(fc>>4)%TW
  ;[[0,8,20,4],[30,5,25,3],[55,10,18,3]].forEach(([bx,by,bw,bh]:number[]) => {
    r((bx+cx2)%TW,by,bw,bh,'rgba(255,255,255,0.06)')
  })

  // 建筑辅助函数
  function brick(x:number,y:number,w:number,h:number,m:string,d:string) {
    r(x,y,w,h,m)
    for(let row=0;row<h;row+=3){const off=(row/3%2===0)?0:4;for(let col=0;col<w;col+=8)r(x+((col+off)%w),y+row,Math.min(7,w-col),1,d)}
  }
  function win(x:number,y:number,ww:number,wh:number,gl:string,fr:string,cu:string) {
    r(x,y,ww,wh,fr);r(x+1,y+1,ww-2,wh-2,gl)
    if(cu){r(x+1,y+1,2,wh-2,cu);r(x+ww-3,y+1,2,wh-2,cu)}
    ctx.fillStyle=fr;ctx.fillRect((x+Math.floor(ww/2))*P,(y+1)*P,P,(wh-2)*P);ctx.fillRect((x+1)*P,(y+Math.floor(wh/2))*P,(ww-2)*P,P)
  }
  function roof(cx:number,ty:number,bw:number,rh:number,c1:string,c2:string) {
    for(let row=0;row<rh;row++){const w2=Math.floor(bw*row/rh);r(cx-w2,ty+row,w2*2,1,row%2===0?c1:c2)}
  }

  const BASE=gndY

  // 花园
  const GA_X=2,GA_W=16
  brick(GA_X,BASE-6,GA_W,6,'#5a7a30','#3a5a18'); r(GA_X,BASE-7,GA_W,1,'#7aaa40')
  r(GA_X+6,BASE-5,4,5,'#1a3010')
  const fc2=['#e04060','#e0a020','#60c040','#e060c0','#60a0e0']
  for(let fi=0;fi<7;fi++){r(GA_X+1+fi*2,BASE-9,2,3,'#30a030');r(GA_X+fi*2,BASE-11,4,3,fc2[fi%5])}
  r(GA_X-2,BASE-18,5,14,'#4a2a10');r(GA_X-6,BASE-28,12,12,'#206030');r(GA_X-4,BASE-26,8,9,'#30a050')
  r(GA_X+15,BASE-12,3,8,'#5a3a18');r(GA_X+13,BASE-20,7,9,'#28703a')

  // 书房
  const LB_X=20,LB_W=18
  brick(LB_X,BASE-22,LB_W,22,'#8a7060','#5a4838')
  roof(LB_X+LB_W/2|0,BASE-28,LB_W+2,6,'#6b3a2a','#8b4a38')
  brick(LB_X+LB_W-4,BASE-30,8,30,'#7a6050','#4a3828')
  roof(LB_X+LB_W,BASE-36,10,6,'#4a2a18','#6a3a28')
  r(LB_X+7,BASE-8,4,8,'#2a1808');r(LB_X+7,BASE-8,4,1,'#c8a060')
  win(LB_X+2,BASE-18,5,7,'#7ab0d0','#c8a060','#c07060')
  win(LB_X+11,BASE-18,5,7,'#7ab0d0','#c8a060','#c07060')
  win(LB_X+LB_W-2,BASE-24,4,5,'#8090c0','#a08060','')

  // 主楼（客厅）
  const ML_X=40,ML_W=24
  brick(ML_X,BASE-32,ML_W,32,'#9a8070','#6a5040')
  roof(ML_X+ML_W/2|0,BASE-40,ML_W+4,8,'#7a4030','#9a5040')
  r(ML_X-2,BASE-32,ML_W+4,2,'#b08060')
  r(ML_X+6,BASE-44,4,12,'#6a4838');r(ML_X+5,BASE-45,6,2,'#7a5848')
  r(ML_X+6,BASE-47,2,2,'rgba(200,200,200,0.3)');r(ML_X+7,BASE-50,2,3,'rgba(200,200,200,0.18)')
  r(ML_X+9,BASE-12,6,12,'#2a1a08');r(ML_X+9,BASE-12,6,1,'#e0c060');r(ML_X+12,BASE-12,1,12,'#4a3020')
  ctx.fillStyle='#e0d080';ctx.beginPath();ctx.arc((ML_X+ML_W/2)*P,(BASE-24)*P,4*P,0,Math.PI*2);ctx.fill()
  ctx.fillStyle='#7090c0';ctx.beginPath();ctx.arc((ML_X+ML_W/2)*P,(BASE-24)*P,3*P,0,Math.PI*2);ctx.fill()
  win(ML_X+2,BASE-22,5,7,'#70a8d0','#c8a060','#c08060')
  win(ML_X+17,BASE-22,5,7,'#70a8d0','#c8a060','#c08060')
  win(ML_X+3,BASE-30,4,5,'#8090c0','#a08060','')
  win(ML_X+17,BASE-30,4,5,'#8090c0','#a08060','')
  for(let st=0;st<3;st++) r(ML_X+7-st*2,BASE-st,ML_W-14+st*4,1,'#b09070')

  // 实验室
  const LA_X=66,LA_W=18
  brick(LA_X,BASE-22,LA_W,22,'#303850','#1a2030')
  const dR=9,dCX=LA_X+LA_W/2,dTY=BASE-30
  for(let dy=0;dy<8;dy++){const dw=Math.floor(dR*Math.sqrt(1-((dy-8)/8)**2));r(dCX-dw|0,dTY+dy,dw*2,1,dy%2===0?'#405080':'#506090')}
  r(dCX-1|0,dTY-1,3,2,'#c0d0ff')
  ctx.fillStyle='rgba(100,160,255,0.25)';ctx.fillRect((LA_X+3)*P,(BASE-18)*P,5*P,7*P);ctx.fillRect((LA_X+10)*P,(BASE-18)*P,5*P,7*P)
  win(LA_X+3,BASE-18,5,7,'#6090e0','#4060a0','')
  win(LA_X+10,BASE-18,5,7,'#6090e0','#4060a0','')
  r(LA_X+7,BASE-8,4,8,'#101828');r(LA_X+6,BASE-10,6,3,'#101828');r(LA_X+7,BASE-8,4,1,'#4060a0')

  // 仓库
  const ST_X=86,ST_W=14
  brick(ST_X,BASE-16,ST_W,16,'#7a6848','#5a4830')
  r(ST_X-1,BASE-17,ST_W+2,2,'#8a7858')
  for(let zi=0;zi<(ST_W/3|0);zi++) r(ST_X+zi*3,BASE-19,2,2,'#8a7858')
  r(ST_X+2,BASE-10,10,10,'#4a3820')
  for(let sl=0;sl<5;sl++) r(ST_X+2,BASE-10+sl*2,10,1,'#5a4830')
  win(ST_X+1,BASE-14,3,4,'#80a070','#a08050','')

  // 地窖入口
  const CV_X=ML_X+5
  r(CV_X,BASE,8,2,'#5a4030');r(CV_X+1,BASE+2,6,2,'#4a3020');r(CV_X+2,BASE+4,4,2,'#3a2010')
  r(CV_X+1,BASE-1,6,1,'#7a6040');r(CV_X+2,BASE-4,4,4,'#1a1010');r(CV_X+2,BASE-4,4,1,'#7a6040')
  const fl=(fc>>3)%3
  r(CV_X-2,BASE-5,2,5,'#e8e0c0');r(CV_X-2,BASE-6-fl,2,1+fl,'#e06020')
  r(CV_X+10,BASE-5,2,5,'#e8e0c0');r(CV_X+10,BASE-6-fl,2,1+fl,'#e06020')
  ctx.fillStyle='rgba(255,160,60,0.12)'
  ctx.beginPath();ctx.arc((CV_X-1)*P,(BASE-5)*P,5*P,0,Math.PI*2);ctx.fill()
  ctx.beginPath();ctx.arc((CV_X+11)*P,(BASE-5)*P,5*P,0,Math.PI*2);ctx.fill()

  // 路灯
  ;[[ML_X-4,BASE-14],[ML_X+ML_W+2,BASE-14]].forEach(([lx,ly]:[number,number]) => {
    r(lx+1,ly,2,14,'#7a6050');r(lx,ly-3,4,3,'#e0d080')
    ctx.fillStyle='rgba(255,240,120,0.18)';ctx.beginPath();ctx.arc((lx+2)*P,ly*P,5*P,0,Math.PI*2);ctx.fill()
  })
  // 喷泉
  r(GA_X+GA_W+2,BASE-5,8,5,'#507090');r(GA_X+GA_W+5,BASE-8,2,3,'#80b0d0')
  ctx.fillStyle='rgba(100,180,220,0.4)';ctx.beginPath();ctx.arc((GA_X+GA_W+6)*P,(BASE-9)*P,3*P,0,Math.PI*2);ctx.fill()
  // 石板路
  for(let pi=0;pi<ML_W-14;pi+=2) r(ML_X+7+pi,BASE,1,3,'#8a7860')
  // 远山
  const hillY=Math.floor(TH*0.50)
  ;[[10,hillY,30,16],[45,hillY-4,28,18],[72,hillY,25,14]].forEach(([hx,hy,hw,hh]:[number,number,number,number]) => {
    for(let hr=0;hr<hh;hr++){const ww=Math.floor(hw*Math.sqrt(1-(hr/hh)**2));r(hx+Math.floor(hw/2)-ww,hy+hr,ww*2,1,hr<3?'#204828':'#1a3820')}
  })
}

function loop() { fc++; if(fc%8===0) draw(); raf=requestAnimationFrame(loop) }

onMounted(() => { nextTick(() => { draw(); raf=requestAnimationFrame(loop); window.addEventListener('resize',draw) }) })
onUnmounted(() => { cancelAnimationFrame(raf); window.removeEventListener('resize',draw) })
</script>

<style scoped>
.castle-view { width:100%; height:100%; display:flex; flex-direction:column; background:#0b0820; font-family:'PixelFont',monospace; position:relative; overflow:hidden; }
.castle-header { display:flex; justify-content:space-between; align-items:center; padding:5px 12px; background:rgba(15,10,32,0.95); border-bottom:2px solid #5a3a6a; z-index:10; }
.castle-title { display:flex; align-items:center; gap:8px; font-size:12px; color:#e0c060; }
.lv-badge { font-size:9px; background:#e0c060; color:#1a1228; padding:1px 5px; }
.castle-controls { display:flex; gap:5px; }
.ctrl-btn { background:rgba(255,255,255,0.06); border:1px solid #5a3a6a; color:#c0a0c0; font-size:10px; padding:3px 8px; cursor:pointer; font-family:inherit; }
.ctrl-btn:hover { background:rgba(255,255,255,0.14); }
.ctrl-green { border-color:#3a6a20; color:#80c060; }
.ctrl-green:hover { background:rgba(60,120,30,0.3); }
.ctrl-red { border-color:#6a2020; color:#e06060; }
.ctrl-red:hover { background:rgba(120,40,40,0.35); }
.scene-wrap { flex:1; position:relative; overflow:hidden; }
.scene-canvas { position:absolute; inset:0; width:100%; height:100%; image-rendering:pixelated; image-rendering:crisp-edges; }
.zone-spot { position:absolute; cursor:pointer; display:flex; flex-direction:column; align-items:center; padding-bottom:4px; }
.zone-label { display:flex; align-items:center; gap:4px; background:rgba(10,6,24,0.80); border:1px solid rgba(160,120,200,0.35); padding:2px 8px; font-size:10px; color:#d0b0d0; transition:background 0.15s; }
.zone-spot:hover .zone-label { background:rgba(80,40,120,0.6); color:#fff; }
.zone-spot.over .zone-label { border-color:#e0c060; background:rgba(80,60,10,0.7); color:#e0c060; }
.cnt { font-size:9px; color:#a08090; }
.drop-badge { margin-top:3px; background:#e0c060; color:#1a1228; font-size:10px; padding:2px 8px; border:1px solid #c0a040; }
.ctx-bg { position:fixed; inset:0; z-index:1998; }
.ctx-box { position:fixed; z-index:1999; min-width:160px; background:#1a1030; border:2px solid #5a3a6a; box-shadow:4px 4px 0 rgba(0,0,0,0.5); padding:4px 0; }
.ctx-head { padding:5px 12px 3px; font-size:11px; color:#7a5a8a; }
.ctx-hr { border:none; border-top:1px solid #3a2a4a; margin:3px 8px; }
.ctx-row { display:block; width:100%; padding:5px 12px; background:none; border:none; text-align:left; font-family:inherit; font-size:11px; color:#c0a0c0; cursor:pointer; }
.ctx-row:hover { background:#3a2a4a; color:#fff; }
.ctx-primary { color:#e0c060; }
.ctx-primary:hover { background:#3a3010; }
.qa-overlay { position:fixed; inset:0; z-index:2000; display:flex; align-items:center; justify-content:center; background:transparent; pointer-events:none; }
.qa-box { pointer-events:auto; width:380px; background:#1a1030; border:2px solid #5a3a6a; box-shadow:0 8px 30px rgba(0,0,0,0.7),4px 4px 0 #2a1a40; padding:14px; }
.qa-head { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#d0b0d0; margin-bottom:10px; }
.x-btn { background:none; border:none; color:#5a3a6a; font-size:13px; cursor:pointer; }
.x-btn:hover { color:#e06060; }
.px-input { width:100%; box-sizing:border-box; background:#0f0a20; border:1px solid #3a2a5a; color:#d0c0e0; font-family:inherit; font-size:11px; padding:5px 8px; margin-bottom:8px; outline:none; display:block; }
.px-ta { resize:none; }
.drop-zone { border:2px dashed #3a2a5a; padding:10px; text-align:center; font-size:10px; color:#7a5a8a; margin-bottom:10px; min-height:40px; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
.drop-zone.active { border-color:#e0c060; background:rgba(224,192,96,0.07); color:#e0c060; }
.link { color:#e0c060; cursor:pointer; text-decoration:underline; }
.file-chips { display:flex; flex-wrap:wrap; gap:5px; }
.chip { background:#2a1a40; border:1px solid #5a3a6a; padding:2px 6px; font-size:9px; color:#c0a0c0; }
.qa-foot { display:flex; justify-content:flex-end; }
.px-btn { background:#2a4a20; border:2px solid #4a8a30; color:#90d060; font-family:inherit; font-size:11px; padding:4px 14px; cursor:pointer; }
.px-btn:hover { background:#3a6a28; }
.growth-box { position:absolute; right:12px; top:40px; width:260px; background:#1a1030; border:2px solid #5a3a6a; box-shadow:4px 4px 0 rgba(0,0,0,0.4); padding:12px; z-index:100; }
.growth-head { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#d0b0d0; margin-bottom:8px; }
.stage-row { display:flex; gap:8px; align-items:center; padding:3px 0; opacity:0.4; font-size:10px; color:#c0a0c0; }
.stage-row.done { opacity:0.7; }
.stage-row.cur { opacity:1; color:#e0c060; }
.stage-sub { font-size:9px; color:#7a5a8a; }
.prog-label { font-size:9px; color:#7a5a8a; margin:8px 0 4px; }
.prog-bar { height:6px; background:#1a0a2a; border:1px solid #3a2a5a; }
.prog-fill { height:100%; background:#7050c0; transition:width 0.5s; }
.grow-enter-active, .grow-leave-active { transition:all 0.2s; }
.grow-enter-from, .grow-leave-to { opacity:0; transform:translateY(8px); }
</style>
