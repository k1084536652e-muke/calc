const I = {
 restore:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
 more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
 search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 check:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
 lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 house:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 grid:'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
 folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
 plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
 trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
 gear:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
 share:'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
 move:'<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
 pen:'<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
 imgplus:'<path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>',
 fileplus:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
 folderminus:'<path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
 folderplus:'<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
 filetext:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
 tick:'<path d="M20 6 9 17l-5-5"/>',
 x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
 chev:'<path d="m9 18 6-6-6-6"/>',
 chevl:'<path d="m15 18-6-6 6-6"/>',
 chevu:'<path d="m18 15-6-6-6 6"/>',
 aa:'<path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16"/><path d="M15.697 14h5.606"/><path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"/><path d="M3.304 13h6.392"/>',
 checks:'<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
 /* R9-02：Lucide v1.65.0 square-check-big / square-x，ISC License © Lucide Icons and Contributors */
 selall:'<path d="M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344"/><path d="m9 11 3 3L22 4"/>',
 selnone:'<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
 list:'<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
 olist:'<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
 indent:'<path d="M21 12H11"/><path d="M21 18H11"/><path d="M21 6H11"/><path d="m3 8 4 4-4 4"/>',
 palette:'<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
 undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
 redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
 brush:'<path d="m16 22-1-4"/><path d="M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1"/><path d="M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233z"/><path d="m8 22 1-4"/>',
 minus:'<path d="M5 12h14"/>',
 /* R10-05：Lucide v1.65.0 play / pause，ISC License © Lucide Icons and Contributors */
 play:'<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
 pause:'<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
};
const ic = (n, cls="") => `<svg class="i ${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;


/* ========== 真实数据层的接入点 ==========
   本文件是定稿原型（ui-final-v2）UI 代码的移植：结构、class、文案、动画全部保持原样，
   只把「演示用的假数据 / 假操作」换成真实存储（Vault + MediaCache）与真实逻辑。
   ——视觉相关的代码零改动；新增的只有 data-thumb / data-* 这类不可见钩子。 */

import {
  sanitizeDecimal, parseAmount, fmt,
  calculateMortgage, calculateIncomeTax,
} from "./core/calc.js";
import { Vault, PIN_RE, DEFAULT_SETTINGS, quotaError } from "./core/repo.js";
import { MediaCache } from "./core/media.js";
import { DocEditor, toBrowseHTML } from "./ui/doc-editor.js";
import { APP_VERSION } from "./version.js";
/** 封面诊断入口：默认关闭。改为 true 后，设置 › 长按「版本」可打开诊断对话框（见 NOTES-220.md）。 */
const COVER_DIAG_ENABLED = false;
import { warmLegacyDetection, legacyMigrationState, migrateLegacy } from "./legacy-migrate.js";
import { checkForUpdate, applyUpdate, registerSW } from "./core/updater.js";
import * as Stream from "./core/stream.js";

/** 仓储与媒体缓存（由 initUI 注入） */
let vault = null;
let media = null;

/** 2.1.2：**新建**解锁码 / 紧急清除码统一要求 6–9 位数字。
    旧版本（2.0.x / 2.1.x 早期）已存的 4–5 位码必须继续可解锁、可作为「当前解锁码」验证、
    已存的旧清除码也必须继续可清除 —— 所以「校验已有码」仍用 core 的 PIN_RE（4–9 位，本层不改存储与核心规则），
    只有「设置新码」才走 NEW_PIN_RE。 */
const NEW_PIN_RE = /^\d{6,9}$/;
/** 本 session 是否已经提示过「旧短码建议升级」（每 session 只提示一次） */
let pinShortHinted = false;
/** 当前解锁码是否为旧短码（4–5 位）：解锁成功后记录在内存里，供设置页提示，不落盘、不进日志 */
let pinIsShort = false;

/** 假照片生成器（原型 rng/palettes/photo）已删除：缩略图改为解密后的真实 Blob objectURL，
    见 bgFor() / media.paintThumbs()。 */

/** 秒 → 「m:ss」/「h:mm:ss」时长标签（视频右下角角标用） */
function fmtDur(sec){
  if(!Number.isFinite(sec)||sec<0) return "";
  const s=Math.round(sec), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
  return h?`${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`:`${m}:${String(ss).padStart(2,"0")}`;
}
/* 旧演示数据（ITEMS / FOLDERS / MEMB / FD_OUT / TRASH）已删除：解锁时由 hydrate() 从仓储填充。 */
let ITEMS = [];
let FOLDERS = [];
let TRASH = [];

/* ========== 仓储记录 → UI 结构 ==========
   UI 层沿用原型的数据形状（name / doc / video / dur / kind），另挂 ref 指向仓储记录；
   任何写操作都同时更新 ref 并持久化（改名后翻到别的文件再翻回来仍是新名字）。 */
function toUIItem(rec){
  return {
    id:rec.id, name:rec.name,
    doc:rec.kind==="doc"||rec.kind==="file",
    video:rec.kind==="video",
    kind:rec.kind,
    dur:fmtDur(rec.dur),
    hasThumb:!!rec.hasThumb,
    trash:!!rec.trashedAt,
    trashedAt:rec.trashedAt||null,
    folderIds:new Set(rec.folderIds||[]),
    ref:rec,
  };
}
/** 解锁后把索引灌进 UI 层 */
function hydrate(){
  ITEMS = vault.items.map(toUIItem);
  FOLDERS = vault.folders.map(f=>({id:f.id,n:f.n,s:(f.coverIds||[]).slice(),c:0,ref:f}));
  refreshFolderCards();   /* 封面与计数一律以未删除条目为准（避免软删后仍显示旧封面） */
  refreshTrashDays();
  S.showNames = !!vault.settings.showNames;
  S.retention = String(vault.settings.retention||"30");
  S.slideInt = String(vault.settings.slideInt||"3");
  S.autoLock = String(vault.settings.autoLock||"never");
  S.wipeOn = !!(vault.auth && vault.auth.wipe);
}
/** 回收站剩余天数（保留时间取设置；「永不」显示为大数） */
function trashDaysLeft(it){
  if(!it.trashedAt) return 0;
  if(S.retention==="never") return 9999;
  const days=+S.retention||30;
  return Math.max(0, Math.ceil((it.trashedAt+days*86400000-Date.now())/86400000));
}
/** 重算回收站列表与剩余天数（回收站里的项目不重排，就地更新文案，避免调用方随后 render 时闪一下） */
function refreshTrashDays(){
  TRASH = ITEMS.filter(it=>it.trash).map(it=>({id:it.id,name:it.name,days:trashDaysLeft(it),doc:it.doc,video:it.video,ref:it}));
  document.querySelectorAll("#a-body .trow").forEach(row=>{
    const t=TRASH.find(x=>x.id===row.dataset.tid);
    const s=row.querySelector("small");
    if(t&&s) s.textContent=t.days>=9999?"不会自动删除":t.days+" 天后删除";
  });
  return TRASH;
}
/** 写库失败不打断界面，但要明确告知（不静默丢数据） */
function saveFail(err){
  console.error(err);
  toast(quotaError(err)?"本机存储空间不足，未能保存":"保存失败，请重试");
}
function persistItem(it){
  it.ref.name=it.name;
  if(it.folderIds) it.ref.folderIds=[...it.folderIds];
  syncNameDom(it.id,it.name);   /* 名字变了就同步已渲染的列表文字（§3.4：重命名要刷新所有列表 / 缓存） */
  return vault.saveItem(it.ref).catch(saveFail);
}
/** 只改已渲染列表里的名字文字，不调用 render()：查看器是叠在列表之上的覆盖层，重命名时列表在下面看不见，
    关掉后必须已是新名字；而重排 / 重绘会带来 FLIP 与滚动位置变化（视觉与动画必须零改动）。 */
function syncNameDom(id,name){
  const cell=`#a-body .cell[data-id="${id}"]`;
  document.querySelectorAll(`${cell} .tname,${cell} .dt`).forEach(el=>{ el.innerHTML=hl(name); });
  document.querySelectorAll(`#a-body .trow[data-tid="${id}"] .tmeta b`).forEach(el=>{ el.innerHTML=hl(name); });
}
/** 缩略图背景：已解密 → 直接用 objectURL；未就绪 → 先留空，解密完成后由 paintThumbs 贴上 */
function bgFor(it){
  if(!it) return "none";
  const u=media.url("thumb",it.id);
  return u?`url("${u}")`:"none";
}

const S={picking:false,
  view:"calc",
  tab:"photos",
  search:false, q:"", filter:"all",
  select:false, sel:new Set(),
  plus:false,
  showNames:false,
  folder:null,
  sub:null,
  doc:null,
  retention:"30",
  slideInt:"3",   /* R10-09：幻灯片间隔（秒），设置页「幻灯片间隔」子页可选 2 / 3 / 5 / 8 */
  autoLock:"never", /* 2.2.0：自动锁定；never / 60 / 120 / 300（秒） */
  wipeOn:false,   /* 紧急清除码是否已配置（来自仓储，不在本地明文里留痕） */
  limit:20,       /* §18 增量加载：当前已渲染批次数 × 20 */
  searchAnim:false, sort:"recent", pageEnd:"done", /* 文档页：{id,title,isNew,mode:"view"|"edit",sheet:bool} */ /* 设置子页：null / "pin" / "wipe" */
  calcPref:(function(){try{return localStorage.getItem("calc-theme")||"night"}catch(e){return"night"}})(),
  albumPref:(function(){try{return localStorage.getItem("album-theme")||localStorage.getItem("calc-theme")||"night"}catch(e){return"night"}})(),
  repayment:"equal-payment",
  calcMode:"mortgage",
};

/** 房贷计算入口（wireCalc 装配；解锁判定失败后回落到这里，保证伪装层照常可用） */
let runMortgageCalc = () => {};

/* 两套独立外观：计算器（calc-theme，解锁前读取）与相册（album-theme，解锁后）。 */
function resolveTheme(pref){ return pref==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"night":"day"):(pref==="day"?"day":"night"); }
function applyCurrentTheme(){
  const t=resolveTheme(S.view==="album"?S.albumPref:S.calcPref);
  document.documentElement.setAttribute("data-theme", t);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = t==="day"?"#ffffff":"#000000";
}
function setThemePref(kind, pref){
  pref=pref||"night";
  if(kind==="calc"){ S.calcPref=pref; try{localStorage.setItem("calc-theme",pref)}catch(e){} }
  else { S.albumPref=pref; try{localStorage.setItem("album-theme",pref)}catch(e){} }
  applyCurrentTheme();
}
/* 旧接口：同时设置两者（仅供调试 / 截图脚本） */
function applyTheme(pref){ setThemePref("calc",pref); setThemePref("album",pref); }
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",applyCurrentTheme)}catch(e){}

function toast(msg){
  const layer=document.getElementById("layer");
  const el=document.createElement("div");
  layer.querySelectorAll(".toast").forEach(x=>x.remove());
  el.className="toast"; el.textContent=msg;
  layer.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
  setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=>el.remove(),220); },2000);
}

/** 进入相册（已解锁后调用）：先把仓储索引灌进 UI，再切换视图 */
function openAlbum(){
  hydrate();
  S.view="album"; S.tab="photos"; S.search=false; S.q=""; S.filter="all";
  S.select=false; S.sel=new Set(); S.plus=false; S.plusResume=false; S.folder=null; S.sub=null; S.doc=null;
  S.limit=20; render._sig=null; refreshBody._sig=null;
  document.getElementById("loan-amount").value="";
  document.getElementById("mortgage-result").hidden=true;
  document.getElementById("mortgage-error").hidden=true;
  showView();
  render();
}
/* 2.1.2 隐私遮罩：iOS 主屏应用切后台、Android 最近任务、来电 / 控制中心都会由系统「拍照」当快照，
   而快照可能早于 visibilitychange 的异步收尾。这里在事件回调里**同步**把相册换成计算器外观
   （只切两个 hidden，不动任何样式 / 动画 / DOM 结构），保证快照里是伪装层、拍不到照片。
   遮罩 ≠ 锁定：只有 visibilityState 变 hidden / pagehide 才继续走原有的自动锁（清密钥 + 清 objectURL）；
   临时失焦（系统输入弹窗、文件选择器、通知中心）只遮不锁，回到前台（focus / visible）原样还原。 */
let privacyCovered=false;
function privacyCover(){
  if(privacyCovered||S.view!=="album") return;
  privacyCovered=true;
  document.getElementById("v-album").hidden=true;
  document.getElementById("v-calc").hidden=false;
}
function privacyUncover(){
  if(!privacyCovered) return;
  privacyCovered=false;
  if(S.view!=="album") return;   /* 已经锁上了（lock() → showView()），按锁定的算 */
  document.getElementById("v-album").hidden=false;
  document.getElementById("v-calc").hidden=true;
}

/* ===== 2.2.0 自动锁定（设置 › 安全 › 自动锁定）=====
   无操作计时；播放视频 / 幻灯片进行中不计时，暂停或结束后重新起算。
   切后台仍由 visibilitychange 立即锁定（与本计时无关）。 */
let autoLockTimer=null;
let autoLockLast=0;
let _autoLockNow=()=>Date.now();
function autoLockMs(){
  const v=String(S.autoLock||"never");
  if(v==="never"||v==="0"||v==="") return 0;
  const n=Number(v);
  return Number.isFinite(n)&&n>0 ? n*1000 : 0;
}
function isPlaybackActive(){
  try{
    const pager=window.__pager;
    if(pager&&pager.slideshow&&!pager.paused) return true;
  }catch(_){}
  if(document.querySelector("#layer .viewer .plyr--playing")) return true;
  const vid=document.querySelector("#layer .viewer video");
  if(vid && !vid.paused && !vid.ended) return true;
  return false;
}
function clearAutoLock(){
  if(autoLockTimer){ clearTimeout(autoLockTimer); autoLockTimer=null; }
}
function bumpAutoLock(){
  autoLockLast=_autoLockNow();
  armAutoLock();
}
function armAutoLock(){
  clearAutoLock();
  if(S.view!=="album") return;
  if(S.picking||importing||migrating) return;
  const ms=autoLockMs();
  if(!ms) return;
  const left=Math.max(0, ms - (_autoLockNow()-autoLockLast));
  autoLockTimer=setTimeout(tickAutoLock, Math.min(1000, Math.max(50, left)));
}
function tickAutoLock(){
  autoLockTimer=null;
  if(S.view!=="album") return;
  const ms=autoLockMs();
  if(!ms) return;
  if(S.picking||importing||migrating){ bumpAutoLock(); return; }
  /* 后台由 visibility 立即锁，这里不重复；回到前台后会 bump */
  if(typeof document!=="undefined" && document.visibilityState==="hidden") return;
  if(isPlaybackActive()){
    /* 播放中不计时：把「最后活动」推到现在，等价于冻结倒计时 */
    autoLockLast=_autoLockNow();
    armAutoLock();
    return;
  }
  if(_autoLockNow()-autoLockLast >= ms){
    lock();
    return;
  }
  armAutoLock();
}
/** 测试钩子（只读状态 + 可注入 now）；不含密钥 */
export function getAutoLockDebug(){
  return {
    ms:()=>autoLockMs(),
    last:()=>autoLockLast,
    playback:()=>isPlaybackActive(),
    bump:bumpAutoLock,
    arm:armAutoLock,
    tick:tickAutoLock,
    setNow(fn){ _autoLockNow = typeof fn==="function" ? fn : ()=>Date.now(); },
    resetNow(){ _autoLockNow=()=>Date.now(); },
  };
}

/** 锁定回计算器：清空内存密钥与全部 objectURL（§2 / §23） */
function lock(){
  clearAutoLock();
  endPicker();
  privacyCovered=false;
  if(S.doc&&docEditor) saveDocBeforeLeave();
  S.view="calc"; S.plus=false; S.plusResume=false; S.select=false; S.sel=new Set(); S.search=false; S.folder=null; S.sub=null; S.doc=null;
  S.q=""; S.filter="all"; S.limit=20; render._sig=null; refreshBody._sig=null;
  media.clear();
  /* 2.1.2：懒补没有「一次性闸门」了 —— 每次解锁都会继续处理剩下缺封面的视频（见 lazyBackfillCovers） */
  vault.lock();
  showView();
}
function showView(){
  applyCurrentTheme(); /* 同一帧内先切主题再切视图，避免闪烁 */
  privacyCovered=false;
  document.getElementById("v-calc").hidden = S.view!=="calc";
  document.getElementById("v-album").hidden = S.view!=="album";
  document.getElementById("layer").innerHTML="";
}

function aliveItems(){return ITEMS.filter(it=>!it.trash)}
function filteredItems(){
  let list=aliveItems();
  if(S.filter==="photo") list=list.filter(it=>!it.doc&&!it.video);
  else if(S.filter==="video") list=list.filter(it=>it.video);
  else if(S.filter==="doc") list=list.filter(it=>it.doc);
  if(S.q.trim()){
    const q=S.q.trim().toLowerCase();
    list=list.filter(it=>it.name.toLowerCase().includes(q));
  }
  return list;
}

/* 搜索时把匹配字符标红；转义后再包 <mark> */
function hl(name){
  const q=S.q.trim();   /* 收起搜索框后仍保留关键词与高亮（§38） */
  if(!q) return esc(name);
  const i=name.toLowerCase().indexOf(q.toLowerCase());
  if(i<0) return esc(name);
  return esc(name.slice(0,i))+`<mark class="hl">${esc(name.slice(i,i+q.length))}</mark>`+esc(name.slice(i+q.length));
}
const showNames=()=>S.showNames||!!S.q.trim();
function tileHTML(it, selecting){
  const selected=S.sel.has(it.id);
  const mark=`<span class="mark">${ic("tick")}</span>`; /* 常驻，CSS 控制显隐 */
  const selc=S.select&&selected?" sel":"";
  if(it.doc){
    return `<button type="button" class="cell${selc}" data-id="${it.id}"><div class="tile doc"><div class="dt">${hl(it.name)}</div><div class="dl" style="width:92%"></div><div class="dl" style="width:78%"></div><div class="dl" style="width:85%"></div><div class="dl" style="width:50%"></div><span class="dic">${ic("filetext")}</span>${mark}</div>${showNames()?`<div class="tname">${hl(it.name)}</div>`:""}</button>`;
  }
  return `<button type="button" class="cell${selc}" data-id="${it.id}"><div class="tile${it.video?" video":""}" data-thumb="${it.id}" style="background-image:${bgFor(it)}">${it.video?`<span class="dur"><svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>${it.dur}</span>`:""}${mark}</div>${showNames()?`<div class="tname">${hl(it.name)}</div>`:""}</button>`;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function folderCover(f){
  /* 只用未删除、非文档的候选；回收站项绝不当封面 */
  const ids=(f.s||[]).filter(id=>{ const it=ITEMS.find(x=>x.id===id); return it&&!it.trash&&!it.doc; }).slice(0,3);
  if(!ids.length) return `<div class="fcover empty"><div>${ic("folder")}</div></div>`;
  return `<div class="fcover">${ids.map(id=>`<div class="fcth" data-thumb="${id}" style="background-image:${bgFor(ITEMS.find(it=>it.id===id))}"></div>`).join("")}</div>`;
}

function render(opts){
  if(S.view!=="album") return;
  /* 上下文（Tab / 文件夹 / 关键词 / 筛选 / 排序）变化时回到首屏 20 项（§18） */
  const sig=[curCtx(),S.folder||"",S.q,S.filter,S.sort].join("\u0001");
  if(sig!==render._sig){ render._sig=sig; S.limit=20; }
  const nav=document.getElementById("a-nav");
  const body=document.getElementById("a-body");
  const bar=document.getElementById("a-bar");
  const overlay=document.getElementById("a-overlay");
  if(!(S.plus&&overlay.dataset.plusBuilt&&!S.doc)){ overlay.innerHTML=""; delete overlay.dataset.plusBuilt; overlay.classList.remove("is-open","closing"); }
  body.style.paddingBottom="";
  const keepTop=body.scrollTop;   /* R11-04：搜索开着时 scrollTop 就是补偿量，清掉 --sbox-tail 会被 clamp，先记下来重建后放回 */
  body.style.removeProperty("--sbox-h"); body.style.removeProperty("--sbox-tail");

  if(S.doc){ renderSelbar(true); renderDoc(nav,body,bar,overlay); bindAlbum(); return; }

  const ctx=curCtx();
  const f=S.folder?FOLDERS.find(x=>x.id===S.folder):null;
  bar.hidden=!!S.folder;

  /* ---- 全局顶栏（含原地搜索面板） ---- */
  if(ctx==="settings"&&S.sub){
    nav.innerHTML=`<div class="nav-row sub"><button type="button" class="back" data-act="back-sub" aria-label="返回">${ic("chevl")}</button><div class="nav-title"><b>${{pin:"解锁码",wipe:"紧急清除码",autolock:"自动锁定",retention:"回收站保留时间",slideint:"幻灯片间隔"}[S.sub]}</b></div></div>`;
  } else {
    const titles={photos:["首页", `${aliveItems().length} 项`], folders:["文件夹", `${FOLDERS.length} 个`], trash:["回收站", `${TRASH.length} 项`], settings:["设置", ""], folder:[f?f.n:"文件夹", `${folderItems().length} 项`]};
    const [title,count]=titles[ctx];
    const selectable=ctx!=="settings";
    const open=S.searchAnim?!S.search:S.search;
    /* R11-03：播放移到「多选」之后（顺序 放大镜 → 多选 → 播放 → 重命名），按钮本身样式 / 禁用逻辑不变 */
    nav.innerHTML=`<div class="nav-row${S.folder?" sub icons":""}">
      ${S.folder?`<button type="button" class="back" data-act="back-folder" aria-label="返回">${ic("chevl")}</button>`:""}
      <div class="nav-title"><b>${esc(title)}</b>${count?`<small>${count}</small>`:""}</div>
      ${selectable?`<button type="button" class="ibtn${S.search?" on":""}" data-act="toggle-search" aria-label="搜索${S.q.trim()?"（正在筛选）":""}" aria-pressed="${S.search}">${ic("search")}<i class="sdot${S.q.trim()?" show":""}" aria-hidden="true"></i></button>`:""}
      ${selectable?`<button type="button" class="ibtn${S.select?" on":""}" data-act="toggle-select" aria-label="多选" aria-pressed="${S.select}">${ic("checks")}</button>`:""}
      ${S.folder?`<button type="button" class="ibtn" data-act="slideshow" aria-label="幻灯片播放"${slideshowIds().length?"":" disabled"}>${ic("play")}</button>`:""}
      ${ctx==="trash"&&TRASH.length?`<button type="button" class="ibtn danger" data-act="empty-trash" aria-label="清空回收站">${ic("brush")}</button>`:""}
      ${S.folder?`<button type="button" class="ibtn" data-act="rename-folder" aria-label="重命名文件夹">${ic("pen")}</button>`:`<button type="button" class="ibtn" data-act="lock" aria-label="锁定">${ic("lock")}</button>`}
    </div>
    <div class="sbox${open?" open":""}" id="sbox"><div><div class="search-wrap">
      <div class="field">${ic("search")}<input id="q" type="search" placeholder="${ctx==="folders"?"搜索文件夹":"搜索"}" value="${esc(S.q)}" enterkeyhint="search" autocomplete="off"><button type="button" class="clr${S.q?" show":""}" data-act="clear-q" aria-label="清除"><span>${ic("x")}</span></button></div>
      ${segFor(ctx)}
    </div></div></div>`;
  }

  /* ---- 内容 ---- */
  const sOpen=!!document.querySelector("#sbox.open");
  body.className="scroll"+(S.folder?" notab":"")+(S.select&&ctx!=="settings"?" selecting":"")+(sOpen?" reserve":"");
  if(sOpen) body.style.setProperty("--sbox-h", sboxH()+"px");
  if(!(opts&&opts.keepBody)){ const st=body.scrollTop; body.innerHTML=buildBody(ctx); if(opts&&opts.keepScroll) body.scrollTop=st; }
  if(sOpen) sboxTail(body, keepTop);   /* R11-04：重建后把补偿量放回去（内容不足一屏时由 --sbox-tail 撑住，不留上一次的旧值） */

  renderSelbar();

  /* ---- Tab 栏（始终保留） ---- */
  if(!S.folder){
    bar.className="tabbar";
    const trashCount=TRASH.length;
    bar.innerHTML=`
      <button type="button" class="tab ${S.tab==="photos"?"on":""}" data-tab="photos" aria-label="首页" ${S.tab==="photos"?'aria-current="page"':""}>${ic("house")}</button>
      <button type="button" class="tab ${S.tab==="folders"?"on":""}" data-tab="folders" aria-label="文件夹" ${S.tab==="folders"?'aria-current="page"':""}>${ic("folder")}</button>
      <button type="button" class="tab" data-act="plus" aria-label="添加" aria-expanded="${S.plus||S.picking?"true":"false"}"><span class="fab${S.picking||(S.plus&&overlay.dataset.plusBuilt)?" open":""}">${ic("plus")}</span></button>
      <button type="button" class="tab ${S.tab==="trash"?"on":""}" data-tab="trash" aria-label="回收站${trashCount?`（${trashCount}）`:""}" ${S.tab==="trash"?'aria-current="page"':""}>${ic("trash")}${trashCount?`<span class="badge" aria-hidden="true">${trashCount}</span>`:""}</button>
      <button type="button" class="tab ${S.tab==="settings"?"on":""}" data-tab="settings" aria-label="设置${VER.st===1?"（有新版本）":""}" ${S.tab==="settings"?'aria-current="page"':""}>${ic("gear")}${VER.st===1?'<i class="tdot" aria-hidden="true"></i>':""}</button>`;
  }
  renderPlusLayer(opts, overlay, bar);
}
/* 原地多选的选择条（覆盖在 Tab 栏上方，不参与布局） */
/* 出现：从 Tab 栏后方滑入 + 淡入；消失：反向。内容区底部始终预留选择条高度，所以不引起网格位移（§25/§27） */
function renderSelbar(instant){
  const sb=document.getElementById("a-sel");
  const root=document.getElementById("v-album");
  const ctx=curCtx();
  const want=S.select&&ctx!=="settings"&&!S.doc;
  if(!want){
    root.classList.remove("selmode");
    if(sb.classList.contains("hiding")&&!instant) return;   /* 退出动画进行中（如与搜索同时进行时的重渲染）：不打断 */
    clearTimeout(sb._t);
    if(instant||sb.hidden||!sb.classList.contains("show")){ sb.classList.remove("show","hiding"); sb.hidden=true; return; }
    sb.classList.add("hiding"); sb.classList.remove("show");
    sb._t=setTimeout(()=>{ sb.hidden=true; sb.classList.remove("hiding"); },320);
    return;
  }
  clearTimeout(sb._t); sb.classList.remove("hiding");
  if(want){
    const n=S.sel.size, dis=n?"":"disabled";
    const total=selectableIds().length;
    const state=n===0?"none":(n>=total&&total>0?"all":"some");
    const b=(act,icon,label,danger,d)=>`<button type="button" class="sbtn${danger?" danger":""}" data-act="${act}" ${d===undefined?dis:d}>${ic(icon)}<span>${label}</span></button>`;
    const ren=b("sel-rename","pen","重命名",0,n===1?"":"disabled");
    /* R9-02：全选 / 取消全选单按钮，三态 none/some/all 只区分是否已全选；全集为空时禁用 */
    const tog=b("sel-toggle-all",state==="all"?"selnone":"selall",state==="all"?"取消全选":"全选",0,total?"":"disabled");
    const acts= tog + (ctx==="trash" ? b("sel-restore","restore","恢复")+b("sel-purge","trash","删除",1)
              : ctx==="folders" ? ren+b("sel-export","share","导出")+b("sel-del","trash","删除",1)
              : ctx==="folder" ? b("sel-addf","folderplus","加入文件夹")+b("sel-out","folderminus","移出")+ren+b("sel-export","share","导出")+b("sel-del","trash","删除",1)
              : b("sel-addf","folderplus","加入文件夹")+ren+b("sel-export","share","导出")+b("sel-del","trash","删除",1));
    /* R9-03：「已选 N 项」为纯文字（不再可点、无 ‹） */
    sb.innerHTML=`<span class="sc">已选 <b>${n}</b> 项</span><div class="sacts">${acts}</div>`;
    const wasShown=!sb.hidden&&sb.classList.contains("show");
    sb.className="selbar"+(S.folder?" last":"")+(wasShown?" show":"");
    sb.hidden=false; root.classList.add("selmode");
    if(!wasShown){ void sb.offsetWidth; sb.classList.add("show"); }
  }
}
function selectableIds(){
  const ctx=curCtx();
  if(ctx==="photos") return filteredItems().map(it=>it.id);
  if(ctx==="folder") return folderItems().filter(it=>matchQ(it.name)&&matchF(it)).map(it=>it.id);
  if(ctx==="folders") return FOLDERS.filter(f=>matchQ(f.n)).map(f=>f.id);
  if(ctx==="trash") return TRASH.filter(t=>matchQ(t.name)&&matchF(t)).map(t=>t.id);
  return [];
}
/* 进入 / 退出多选：只切 class、更新顶栏按钮与选择条，不重建内容、不播放 FLIP（§25） */
function applySelect(){
  const body=document.getElementById("a-body");
  const ctx=curCtx();
  body.classList.toggle("selecting", S.select&&ctx!=="settings");
  body.querySelectorAll(".sel").forEach(el=>el.classList.remove("sel"));
  S.sel.forEach(k=>markSel(k,true));
  const b=document.querySelector('#a-nav [data-act="toggle-select"]');
  if(b){ b.classList.toggle("on",S.select); b.setAttribute("aria-pressed",String(S.select)); }
  const sbtn=document.querySelector('#a-nav [data-act="toggle-search"]');
  if(sbtn){
    sbtn.removeAttribute("disabled"); sbtn.removeAttribute("aria-disabled");
    sbtn.classList.remove("dim");
    updSearchDot();
  }
  renderSelbar();
}
function markSel(k,on){
  document.querySelectorAll(`#a-body [data-id="${k}"],#a-body [data-folder="${k}"],#a-body [data-tid="${k}"]`).forEach(el=>el.classList.toggle("sel",on));
}
function sboxH(){ const w=document.querySelector("#sbox .search-wrap"); return w?w.offsetHeight:0; }
/* R11-04：把 scrollTop 补偿落到实处——内容不足一屏时给可滚动高度补出缺的那截（--sbox-tail），
   首页内容够长时缺额为 0、不写变量，与改前完全一致。scrollHeight 本身会被 clamp 到 clientHeight，
   所以先塞一个够大的 tail（PROBE）量出内容真实底边，再换算成精确缺额（不写死、不迭代）。 */
function sboxTail(body, target){
  const PROBE=99999;
  body.style.setProperty("--sbox-tail", PROBE+"px");
  const need=Math.max(0, target+body.clientHeight-(body.scrollHeight-PROBE));
  if(need) body.style.setProperty("--sbox-tail", need+"px"); else body.style.removeProperty("--sbox-tail");
  body.scrollTop=target;
}
function renderPlusLayer(opts, overlay, bar){
    if(S.plus){
    if(!overlay.dataset.plusBuilt){
      overlay.innerHTML=`<div class="scrim" data-act="close-plus"></div>
        <div class="pop">
          <button type="button" data-act="add-photo">${ic("imgplus")}上传图片/视频</button>
          <button type="button" data-act="add-doc">${ic("fileplus")}新建文档</button>
          <button type="button" data-act="add-folder">${ic("folderplus")}新建文件夹</button>
        </div>`;
      overlay.dataset.plusBuilt="1";
      overlay.classList.remove("is-open","closing");
      const fab=bar.querySelector(".fab");
      if(reopenPlus){   /* 从「新建文档」返回：菜单原样仍在，不重播弹出动画 */
        overlay.classList.add("noanim","is-open"); fab&&fab.classList.add("noanim","open");
        void overlay.offsetWidth; requestAnimationFrame(()=>{ overlay.classList.remove("noanim"); fab&&fab.classList.remove("noanim"); });
        bindAlbum(); return;
      }
      if(fab) fab.classList.remove("open");
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(!S.plus) return;
        overlay.classList.add("is-open");
        fab&&fab.classList.add("open");
      }));
    } else {
      overlay.classList.add("is-open");
      const fab=bar.querySelector(".fab");
      fab&&fab.classList.add("open");
    }
  } else {
    overlay.innerHTML="";
    delete overlay.dataset.plusBuilt;
    overlay.classList.remove("is-open","closing");
  }

  /* 渲染完成：把已解密的缩略图贴上（不重建内容），并挂上增量加载哨兵 */
  media.paintThumbs(document.getElementById("a-body"));
  if(COVER_DIAG_ENABLED) bindVerLongPress(document.getElementById("a-body"));
  attachSentinel();
  bindAlbum();
}

/* 设置 › 长按「版本」行约 0.65 秒：封面诊断（不改主 UI，仅对话框；含缩略图实图预览） */
async function showCoverDiag(){
  try{
    const Cover=await import("./core/cover.js");
    toast("分析封面中…");
    const d=await Cover.diagnoseCovers(vault);
    const ctrl=navigator.serviceWorker&&navigator.serviceWorker.controller;
    const sw=ctrl?ctrl.scriptURL.replace(/^.*\//,""):"无";
    const previews=[];
    const layer=document.getElementById("layer");
    const wrap=document.createElement("div");
    wrap.className="dlg-back";
    const head=[
      `应用 ${VER.cur} · 封面算法 gen ${d.coverGen}`,
      `SW ${sw}`,
      `可用封面 ${d.withThumb}/${d.totalVideos}（有记录 ${d.withRecord}，缺/坏 ${d.missing}）`,
      `说明：若「有记录」但格子灰，看下方预览与 hypothesis。ok-should-show=字节正常应能显示（多为 Blob MIME 问题，2.1.6 已修）。uniform-blank/tiny=坏图会重取。`,
    ].map(s=>`<div style="margin:0 0 4px">${esc(s)}</div>`).join("");
    const cards=d.rows.slice(0,12).map(r=>{
      const sz=r.size?`${Math.round(r.size/1048576*10)/10}MB`:"?";
      const avg=`rgb(${r.avgR},${r.avgG},${r.avgB})`;
      const img=r.previewUrl
        ?`<img src="${r.previewUrl}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;background:#333;flex:none;border:1px solid rgba(127,127,127,.35)">`
        :`<div style="width:72px;height:72px;border-radius:8px;background:#333;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999">无图</div>`;
      if(r.previewUrl) previews.push(r.previewUrl);
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:.5px solid var(--sep)">
        ${img}
        <div style="min-width:0;font-size:11px;line-height:1.45;word-break:break-all">
          <b style="font-size:12px">${esc(r.name||r.id)}</b><br>
          ${esc(sz)} · ${esc(r.mime||"?")}<br>
          thumb ${r.thumbBytes}B · ${esc(r.thumbMime||"—")} · ${r.thumbW}×${r.thumbH}<br>
          均色 <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${avg};vertical-align:-1px;border:1px solid rgba(127,127,127,.4)"></span> ${avg} · 亮度${r.bright} · 方差${r.variance}${r.uniform?" · 匀色":""}${r.tiny?" · 极小":""}<br>
          hasThumb=${r.hasThumb?"是":"否"} valid=${r.validCover?"是":"否"} fail=${esc(r.coverFail||"—")} gen=${r.coverFailGen??"—"}<br>
          <b>hypothesis=${esc(r.hypothesis)}</b>
        </div>
      </div>`;
    }).join("");
    wrap.innerHTML=`<div class="dlg noinput" role="alertdialog" aria-modal="true" style="max-width:min(420px,92vw);max-height:82vh;overflow:auto">
      <h4>封面诊断</h4>
      <div style="text-align:left;font-size:12px;line-height:1.45;padding:0 4px 8px">${head}${cards||"<div>无视频</div>"}</div>
      <div class="dbtns"><button type="button" data-x="c">关闭</button><button type="button" data-x="o">作废坏图并重试</button></div>
    </div>`;
    layer.appendChild(wrap);
    requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add("show")));
    const revoke=()=>{ for(const u of previews){ try{ URL.revokeObjectURL(u); }catch(_){ } } previews.length=0; };
    const close=()=>{ wrap.style.pointerEvents="none"; wrap.onclick=null; wrap.classList.remove("show"); setTimeout(()=>{ wrap.remove(); revoke(); },180); };
    let downOnBack=false;
    wrap.onpointerdown=e=>{ downOnBack=e.target===wrap; };
    wrap.onclick=async(e)=>{
      if(e.target===wrap){ if(downOnBack) close(); downOnBack=false; return; }
      const b=e.target.closest("[data-x]");
      if(!b) return;
      if(b.dataset.x==="c"){ close(); return; }
      b.disabled=true;
      try{
        const killed=await Cover.invalidateBadThumbs(vault);
        for(const it of vault.items){
          if(it.kind==="video"&&!it.hasThumb){
            delete it.coverFail; delete it.coverFailAt; delete it.coverFailGen; delete it.coverFailMs;
            try{ await vault.saveItem(it); }catch(_){}
          }
        }
        try{ Cover._resetBackfillSession(); }catch(_){}
        toast(killed?`已作废 ${killed} 张坏封面，开始重试…`:"开始重试封面…");
        close();
        lazyBackfillCovers();
        media.clear();
        media.paintThumbs(document.getElementById("a-body"));
        render({keepScroll:true});
      }catch(err){
        b.disabled=false;
        toast("重试失败");
        console.warn(err);
      }
    };
  }catch(err){ toast("诊断失败"); console.warn(err); }
}
function bindVerLongPress(root){
  const row=root.querySelector(".verrow");
  if(!row||row.dataset.lpBound) return;
  row.dataset.lpBound="1";
  let timer=null, fired=false;
  const clear=()=>{ if(timer){ clearTimeout(timer); timer=null; } };
  row.addEventListener("pointerdown",(e)=>{
    if(e.button!=null&&e.button!==0) return;
    fired=false;
    clear();
    timer=setTimeout(()=>{ timer=null; fired=true; showCoverDiag(); }, 650);
  });
  ["pointerup","pointercancel","pointerleave"].forEach(n=>row.addEventListener(n,clear));
  row.addEventListener("click",(e)=>{
    if(fired){ e.preventDefault(); e.stopPropagation(); fired=false; }
  },true);
}
/* 设置 ›「版本」行（§29 / §50）：四种状态；App 永不自动切换版本，只在用户确认后更新 */
const VER={st:0,cur:APP_VERSION,next:"",timer:0};
async function checkUpdate(manual){
  const r=await checkForUpdate();
  if(r.available){
    VER.st=1; VER.next=r.version;
    if(S.view==="album"&&S.tab==="settings"&&!S.sub) render({keepScroll:true});
  }else if(manual){
    VER.st=0;
    if(S.view==="album"&&S.tab==="settings"&&!S.sub) render({keepScroll:true});
    toast("已是最新版本");
  }
}
function promptUpdate(){
  dialog({title:`更新到 ${VER.next}？`, text:"只更新应用本身，相册中的文件、文件夹与设置都不受影响。更新需要几秒钟，完成后会自动重新打开。", ok:"更新", onOk:()=>{
    VER.st=2; render({keepScroll:true});
    applyUpdate().catch(err=>{
      console.warn("更新失败", err);
      VER.st=3;
      if(S.view==="album"&&S.tab==="settings"&&!S.sub) render({keepScroll:true});
      toast("更新失败，已保留原版本");
    });
  }});
}
function verRowHTML(){
  if(VER.st===1) return `<button type="button" class="row verrow" data-act="ver-update" aria-label="版本：当前 ${VER.cur}，发现新版本 ${VER.next}，点击更新">
      <span class="vl"><span>版本<i class="vdot" aria-hidden="true"></i></span><span class="vs">当前 ${VER.cur} · 发现新版本 <b>${VER.next}</b></span></span>
      <span class="upbtn">点击更新</span></button>`;
  if(VER.st===2) return `<div class="row verrow" aria-live="polite">
      <span class="vl"><span>版本</span><span class="vs">正在更新到 ${VER.next}，请勿关闭</span></span>
      <span class="upbtn busy"><i class="spin" aria-hidden="true"></i>正在更新…</span></div>`;
  /* A-08 更新失败：保留原版本 + 重试 */
  if(VER.st===3) return `<button type="button" class="row verrow fail" data-act="ver-retry" aria-label="更新失败，已保留原版本 ${VER.cur}，点击重试">
      <span class="vl"><span>版本</span><span class="vs">更新失败，已保留原版本 ${VER.cur}</span></span>
      <span class="upbtn retry">重试</span></button>`;
  return `<button type="button" class="row verrow" data-act="ver-check" aria-label="版本 ${VER.cur}，已是最新">
      <span class="vl"><span>版本</span><span class="vs">${VER.cur}</span></span>
      <span class="vok">${ic("tick")}已是最新</span></button>`;
}
function settingsBody(){
  if(S.sub==="pin"){
    return `
      <div class="page subpage">
        <div class="gh">解锁码</div>
        <div class="group">
          <label class="row frow" id="fr-cur"><span class="lab">当前解锁码</span><input id="pin-cur" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="请输入" maxlength="9"></label>
          <label class="row frow" id="fr-new"><span class="lab">新解锁码</span><input id="pin-new" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="6–9 位数字" maxlength="9"></label>
          <label class="row frow" id="fr-cf"><span class="lab">确认新解锁码</span><input id="pin-cf" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="再次输入" maxlength="9"></label>
        </div>
        <div class="ferr" id="pin-err" hidden></div>
        <p class="gf">解锁码为 6–9 位数字（与贷款金额整数位上限一致）。在首页贷款金额中输入并点击计算即可进入。</p>
        <button type="button" class="cta" data-act="save-pin">保存</button>
      </div>`;
  } else if(S.sub==="retention"){
    return `
      <div class="page subpage">
        <div class="gh">删除后保留</div>
        <div class="group">${["7","30","90","never"].map(k=>`<button type="button" class="row" data-ret="${k}"><span>${retLabel(k)}</span>${S.retention===k?`<span class="ck">${ic("tick")}</span>`:""}</button>`).join("")}</div>
        <p class="gf">到期的文件会在打开应用时自动删除</p>
      </div>`;
  } else if(S.sub==="slideint"){
    return `
      <div class="page subpage">
        <div class="gh">照片停留时间</div>
        <div class="group">${["2","3","5","8"].map(k=>`<button type="button" class="row" data-slideint="${k}"><span>${k} 秒</span>${S.slideInt===k?`<span class="ck">${ic("tick")}</span>`:""}</button>`).join("")}</div>
        <p class="gf">幻灯片播放时每张照片停留的时长；视频自动播放，播完再切下一张，不受此间隔限制</p>
      </div>`;
  } else if(S.sub==="wipe"){
    return `
      <div class="page subpage">
        <div class="gh">状态</div>
        <div class="group">
          <div class="row"><span>当前状态</span><span class="v">${S.wipeOn?"已配置":"未配置"}</span></div>
        </div>
        <div class="infocard">配置后，在首页输入此码并点击计算，将清除本机所有内容，且无法恢复。须与解锁码不同。</div>
        <div class="gh">设置清除码</div>
        <div class="group">
          <label class="row frow" id="fr-wipe"><span class="lab">清除码</span><input id="wipe-code" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="6–9 位数字" maxlength="9"></label>
          <label class="row frow" id="fr-wipe2"><span class="lab">确认清除码</span><input id="wipe-code2" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="再次输入" maxlength="9"></label>
        </div>
        <div class="ferr" id="wipe-err" hidden></div>
        <button type="button" class="cta" data-act="save-wipe">保存</button>
        <button type="button" class="dangerbtn" data-act="disable-wipe"${S.wipeOn?"":" disabled"}>关闭紧急清除</button>
      </div>`;
  } else if(S.sub==="autolock"){
    return `
      <div class="page subpage">
        <div class="gh">无操作后自动锁定</div>
        <div class="group">${["never","60","120","300"].map(k=>`<button type="button" class="row" data-autolock="${k}"><span>${autoLockLabel(k)}</span>${S.autoLock===k?`<span class="ck">${ic("tick")}</span>`:""}</button>`).join("")}</div>
        <p class="gf">播放视频或幻灯片时不计时；切到后台仍会立即锁定（与「自动锁定」无关）</p>
      </div>`;
  } else {
    return `
      <div class="page">
        <div class="gh">外观</div>
        <div class="group">${[["calc","计算器外观",S.calcPref],["album","相册外观",S.albumPref]].map(([k,l,cur])=>`<div class="row segrow labeled"><span>${l}</span><div class="seg slide" data-kind="${k}" style="--i:${["system","day","night"].indexOf(cur)}"><i class="seg-thumb" aria-hidden="true"></i>
          <button type="button" data-theme-set="system" data-kind="${k}" class="${cur==="system"?"on":""}">跟随系统</button>
          <button type="button" data-theme-set="day" data-kind="${k}" class="${cur==="day"?"on":""}">白天</button>
          <button type="button" data-theme-set="night" data-kind="${k}" class="${cur==="night"?"on":""}">黑夜</button>
        </div></div>`).join("")}</div>
        <p class="gf">计算器外观只能在这里修改，建议设为固定，避免外观无故变化</p>
        <div class="gh">显示</div>
        <div class="group">
          <button type="button" class="row" data-act="toggle-names"><span>显示文件名称</span><span class="toggle ${S.showNames?"on":""}" id="names-tog"></span></button>
          <button type="button" class="row" data-act="open-slideint"><span>幻灯片间隔</span><span class="v">${S.slideInt} 秒${ic("chev")}</span></button>
        </div>
        <div class="gh">回收站</div>
        <div class="group">
          <button type="button" class="row" data-act="open-retention"><span>回收站保留时间</span><span class="v">${retLabel(S.retention)}${ic("chev")}</span></button>
        </div>
        <div class="gh">安全</div>
        <div class="group">
          <button type="button" class="row" data-act="open-pin"><span>解锁码</span><span class="v">修改${ic("chev")}</span></button>
          <button type="button" class="row" data-act="open-wipe"><span>紧急清除码</span><span class="v">${S.wipeOn?"已配置":"未配置"}${ic("chev")}</span></button>
          <button type="button" class="row" data-act="open-autolock"><span>自动锁定</span><span class="v">${autoLockLabel(S.autoLock)}${ic("chev")}</span></button>
        </div>
        <div class="gh">关于</div>
        <div class="group">
          ${verRowHTML()}
        </div>
        <button type="button" class="dangerbtn settings-clear" data-act="clear-all">清空全部数据</button>
        <p class="gf">「清空全部数据」立即删除本机相册内容，与紧急清除码（在计算器输入触发）分开。</p>
      </div>`;
  }

}

/* 长按约 450ms 进入原地多选，并选中该项（触摸与鼠标） */
const LP={timer:0,x:0,y:0,suppress:false};
function lpKey(el){
  const ctx=curCtx();
  if(el.dataset.id&&(ctx==="photos"||ctx==="folder")) return el.dataset.id;
  if(el.dataset.folder&&ctx==="folders") return el.dataset.folder;
  if(el.dataset.tid&&ctx==="trash") return el.dataset.tid;
  return null;
}
function bindLongPress(root){
  const cancel=()=>{ clearTimeout(LP.timer); LP.timer=0; };
  root.onpointerdown=function(e){
    if(S.select||e.button>0) return;
    const el=e.target.closest("[data-id],[data-folder],[data-tid]"); if(!el) return;
    const key=lpKey(el); if(!key) return;
    LP.x=e.clientX; LP.y=e.clientY; cancel();
    LP.timer=setTimeout(()=>{
      LP.timer=0; LP.suppress=true; LP.key=key; if(DS.track) DS.armed=true;
      try{ navigator.vibrate&&navigator.vibrate(8); }catch(_){}
      enterSelect([key]);
      const sel=`[data-id="${key}"],[data-folder="${key}"],[data-tid="${key}"]`;
      const n=document.querySelector("#a-body "+sel.split(",").join(",#a-body "));
      if(n&&!matchMedia("(prefers-reduced-motion: reduce)").matches) n.animate([{transform:"scale(1)"},{transform:"scale(.93)"},{transform:"scale(1)"}],{duration:220,easing:"ease-out"});
      setTimeout(()=>{ LP.suppress=false; },600);
    },450);
  };
  root.onpointermove=function(e){ if(LP.timer&&Math.hypot(e.clientX-LP.x,e.clientY-LP.y)>10) cancel(); };
  root.onpointerup=root.onpointercancel=root.onpointerleave=cancel;
  document.getElementById("a-body").onscroll=cancel;
  root.oncontextmenu=function(e){ if(e.target.closest(".cell,.fcard,.trow")) e.preventDefault(); };
}
/* 拖动多选（§28）：多选中横向起手拖动，或长按进入多选后不松手继续拖动；
   手指经过的每一项在本次拖动中反选一次；靠近上下边缘时内容区自动滚动；竖向起手 = 正常滚动 */
const DS={track:false,decided:false,on:false,armed:false,x0:0,y0:0,x:0,y:0,seen:new Set(),raf:0,mouse:false};
function dsKeyAt(x,y){
  const el=document.elementFromPoint(x,y); if(!el) return null;
  const t=el.closest("#a-body [data-id],#a-body [data-folder],#a-body [data-tid]");
  return t?lpKey(t):null;
}
function dsVisit(){
  const k=dsKeyAt(DS.x,DS.y);
  if(k&&!DS.seen.has(k)){ DS.seen.add(k); toggleSel(k); }
}
function dsEdges(){
  const body=document.getElementById("a-body"), r=body.getBoundingClientRect();
  let bottom=r.bottom;
  const sb=document.getElementById("a-sel"), bar=document.getElementById("a-bar");
  if(sb&&!sb.hidden) bottom=Math.min(bottom,sb.getBoundingClientRect().top);
  else if(bar&&!bar.hidden) bottom=Math.min(bottom,bar.getBoundingClientRect().top);
  const top=r.top+(parseFloat(getComputedStyle(body).getPropertyValue("--sbox-h"))||0);
  return {body,top,bottom};
}
function dsLoop(){
  if(!DS.on) return;
  const {body,top,bottom}=dsEdges(), E=64, MAX=16;
  let v=0;
  if(DS.y<top+E) v=-MAX*Math.min(1,(top+E-DS.y)/E);
  else if(DS.y>bottom-E) v=MAX*Math.min(1,(DS.y-(bottom-E))/E);
  if(v){ const before=body.scrollTop; body.scrollTop+=v; if(body.scrollTop!==before) dsVisit(); }
  DS.raf=requestAnimationFrame(dsLoop);
}
function dsStart(firstKeySeen){
  DS.on=true; DS.decided=true; clearTimeout(LP.timer); LP.timer=0;
  DS.seen=new Set(firstKeySeen?[firstKeySeen]:[]);
  if(!firstKeySeen){ const k0=dsKeyAt(DS.x0,DS.y0); if(k0){ DS.seen.add(k0); toggleSel(k0); } }
  dsVisit(); cancelAnimationFrame(DS.raf); DS.raf=requestAnimationFrame(dsLoop);
}
function dsEnd(){
  const was=DS.on&&DS.mouse;   /* 鼠标拖完会补发 click，需吞掉；触摸拖动不会产生 click */
  DS.on=false; DS.track=false; DS.armed=false; DS.decided=false; cancelAnimationFrame(DS.raf);
  if(was){ LP.suppress=true; setTimeout(()=>{ LP.suppress=false; },400); }
}
function dsMove(x,y,e){
  DS.x=x; DS.y=y;
  if(DS.on){ e.preventDefault(); dsVisit(); return; }
  if(DS.armed){ e.preventDefault(); dsStart(LP.key); return; }
  if(!S.select||DS.decided) return;
  const dx=x-DS.x0, dy=y-DS.y0;
  if(Math.hypot(dx,dy)<8) return;
  DS.decided=true;
  const onTile=!!dsKeyAt(DS.x0,DS.y0);
  if(onTile&&(DS.mouse||Math.abs(dx)>Math.abs(dy)*1.2)){ e.preventDefault(); dsStart(null); }
  else DS.track=false;   /* 竖向起手：交给浏览器滚动 */
}
function bindDragSelect(){
  const body=document.getElementById("a-body");
  if(body._ds) return; body._ds=true;
  body.addEventListener("touchstart",e=>{
    if(e.touches.length!==1){ dsEnd(); return; }
    const t=e.touches[0];
    /* 左缘交给 §60 右滑返回，不启动拖选跟踪 */
    if(t.clientX<=(typeof EB_EDGE==="number"?EB_EDGE:20)&&typeof edgeBackTarget==="function"&&edgeBackTarget()){ DS.track=false; return; }
    DS.track=true; DS.decided=false; DS.mouse=false; DS.armed=false;
    DS.x0=DS.x=t.clientX; DS.y0=DS.y=t.clientY;
  },{passive:true});
  body.addEventListener("touchmove",e=>{ if(!DS.track||e.touches.length!==1) return; const t=e.touches[0]; dsMove(t.clientX,t.clientY,e); },{passive:false});
  body.addEventListener("touchend",dsEnd); body.addEventListener("touchcancel",dsEnd);
  body.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="mouse"||e.button>0) return;
    DS.track=true; DS.decided=false; DS.mouse=true; DS.armed=false; DS.x0=DS.x=e.clientX; DS.y0=DS.y=e.clientY;
  });
  window.addEventListener("pointermove",e=>{ if(e.pointerType!=="mouse"||!DS.track||!DS.mouse) return; if(!(e.buttons&1)){ dsEnd(); return; } dsMove(e.clientX,e.clientY,e); });
  window.addEventListener("pointerup",e=>{ if(e.pointerType==="mouse"&&DS.mouse) dsEnd(); });
}
function resetModes(){ S.search=false; S.searchAnim=false; S.q=""; S.filter="all"; S.select=false; S.sel=new Set(); }
function toggleSel(id){ const on=!S.sel.has(id); if(on) S.sel.add(id); else S.sel.delete(id); markSel(id,on); renderSelbar(); }
function retLabel(k){ return k==="never"?"永不自动删除":k+" 天"; }
function autoLockLabel(k){ return k==="never"?"永不":k+" 秒"; }
/* FLIP：只用 transform / opacity；只动画视口内及附近的元素 */
const FLIP_SEL="[data-flip],[data-id],[data-folder],[data-tid]";
const flipKey=el=>el.dataset.flip||el.dataset.id||el.dataset.folder||el.dataset.tid;
function flipEls(body){ return [...body.querySelectorAll(FLIP_SEL)].filter(el=>{ if(el.closest(".flip-ghost")) return false; const a=el.parentElement.closest(FLIP_SEL); return !(a&&body.contains(a)); }); }
function refreshBody(){
  /* 只刷新内容区与筛选高亮，保留输入框焦点与展开状态 */
  const body=document.getElementById("a-body");
  const sig=[curCtx(),S.folder||"",S.q,S.filter,S.sort].join("\u0001");
  if(sig!==refreshBody._sig){ refreshBody._sig=sig; S.limit=20; }
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const br=body.getBoundingClientRect();
  const near=r=>r.bottom>br.top-120&&r.top<br.bottom+120;
  const before=new Map();
  if(!reduce) flipEls(body).forEach(el=>{ if(el.classList.contains("flip-ghost")) return; const r=el.getBoundingClientRect(); if(near(r)) before.set(flipKey(el),{el,r}); });
  body.style.removeProperty("--sbox-tail");   /* R11-04：内容变了就按新高度重新 clamp（与首页同一口径：结果变少时落到面板下方、看得见） */
  body.innerHTML=buildBody(curCtx());
  if(!reduce){
    const seen=new Set();
    flipEls(body).forEach(el=>{
      const k=flipKey(el), o=before.get(k);
      if(o) seen.add(k);
      const r=el.getBoundingClientRect();
      if(!near(r)&&!(o&&near(o.r))) return;
      if(o){
        const dx=o.r.left-r.left, dy=o.r.top-r.top;
        if(dx||dy) el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],{duration:250,easing:"cubic-bezier(.2,.8,.2,1)",delay:40,fill:"backwards"});
      } else {
        el.animate([{opacity:0,transform:"scale(.85)"},{opacity:1,transform:"none"}],{duration:220,easing:"cubic-bezier(.2,.8,.2,1)",delay:60,fill:"backwards"});
      }
    });
    const br2=body.getBoundingClientRect();
    before.forEach((o,k)=>{
      if(seen.has(k)) return;
      const g=o.el.cloneNode(true); g.classList.add("flip-ghost");
      [g,...g.querySelectorAll(FLIP_SEL)].forEach(n=>["flip","id","folder","tid"].forEach(a=>n.removeAttribute("data-"+a)));
      Object.assign(g.style,{position:"absolute",left:(o.r.left-br2.left+body.scrollLeft)+"px",top:(o.r.top-br2.top+body.scrollTop)+"px",width:o.r.width+"px",height:o.r.height+"px",margin:"0",pointerEvents:"none",zIndex:"-1"});
      body.appendChild(g);
      g.animate([{opacity:1,transform:"none"},{opacity:0,transform:"scale(.85)"}],{duration:180,easing:"ease-in",fill:"forwards"}).onfinish=()=>g.remove();
    });
  }
  document.querySelectorAll("#sbox [data-filter]").forEach(b=>b.classList.toggle("on",b.dataset.filter===S.filter));
  document.querySelectorAll("#sbox [data-sort]").forEach(b=>b.classList.toggle("on",b.dataset.sort===S.sort));
  media.paintThumbs(body);
  attachSentinel();
}
function curCtx(){ return S.folder?"folder":S.tab; }
/* 文件夹内容 = 归属该文件夹且未删除的条目（文件夹非互斥，§31：一个文件可在多个文件夹里） */
function folderItemsFor(fid){ return ITEMS.filter(it=>!it.trash&&it.folderIds.has(fid)); }
function folderItems(){ return folderItemsFor(S.folder); }
function syncFolderCount(fid){
  const f=FOLDERS.find(x=>x.id===fid); if(!f) return;
  f.c=ITEMS.filter(it=>!it.trash&&it.folderIds.has(fid)).length;
}
/** 按存活条目重算全部文件夹封面候选 + 计数（软删/恢复/移入移出后立刻刷新首页横条与文件夹页） */
function refreshFolderCards(){
  for(const f of FOLDERS){
    f.s=ITEMS.filter(it=>!it.trash&&!it.doc&&it.folderIds.has(f.id)).slice(0,3).map(it=>it.id);
    syncFolderCount(f.id);
  }
}
/** 归属集合：直接读写条目的 folderIds（非互斥） */
function memOf(id){ const it=ITEMS.find(x=>x.id===id); return it?it.folderIds:new Set(); }
const matchQ=name=>!S.q.trim()||name.toLowerCase().includes(S.q.trim().toLowerCase());
const matchF=it=>S.filter==="all"||(S.filter==="photo"&&!it.doc&&!it.video)||(S.filter==="video"&&it.video)||(S.filter==="doc"&&it.doc);
function segFor(ctx){
  const segBtn=(attr,key,label,cur)=>`<button type="button" data-${attr}="${key}" class="${cur===key?"on":""}">${label}</button>`;
  if(ctx==="settings") return "";
  if(ctx==="folders") return "";
  const opts=[["all","全部"],["photo","图片"],["video","视频"],["doc","文档"]];   /* R9-04：删除「文件夹」筛选项 */
  return `<div class="seg" id="filter-seg">${opts.map(([k,l])=>segBtn("filter",k,l,S.filter)).join("")}</div>`;
}
function fcardHTML(f, selecting){
  const sel=S.select&&curCtx()==="folders"&&S.sel.has(f.id);
  const mark=`<span class="mark">${ic("tick")}</span>`;
  return `<button type="button" class="fcard${sel?" sel":""}" data-folder="${f.id}"><div class="fwrap">${folderCover(f)}${mark}</div><div class="fname">${hl(f.n)}</div><div class="fcount">${f.c} 项</div></button>`;
}
/* 原型一次性渲染全部演示项；正式应用按 DESIGN-NOTES §18 分批解密 / 渲染（每批约 20 项，哨兵触发下一批）。 */
/* A-03 分页脚：固定 44px；还有下一批时「加载中」，全部渲染完「到底啦」（§48 / §18） */
function pageEndHTML(ctx, more){
  if(ctx==="settings") return "";
  if(more) return `<div class="page-end" role="status"><i class="spin" aria-hidden="true"></i>加载中</div>`;
  return `<div class="page-end done" role="status">到底啦</div>`;
}
/* A-06 两种空状态 */
function emptyTrue(kind){
  const map={
    photos:`<div class="empty-state soft">${ic("imgplus")}<p>还没有文件</p><small style="color:var(--faint);font-size:13px">点底部 ＋ 上传图片/视频或新建文档</small></div>`,
    folder:`<div class="empty-state soft">${ic("folder")}<p>文件夹是空的</p><small style="color:var(--faint);font-size:13px">从首页把文件加入此文件夹</small></div>`,
    folders:`<div class="empty-state soft">${ic("folderplus")}<p>还没有文件夹</p></div>`,
    trash:`<div class="empty-state">${ic("trash")}<p>回收站为空</p></div>`,
  };
  return map[kind]||`<div class="empty-state soft"><p>暂无内容</p></div>`;
}
function emptySearch(){
  const q=S.q.trim();
  const tip=q?`没有匹配「${esc(q)}」的项目`:"没有匹配的项目";
  return `<div class="empty-note search-empty">${tip}</div>`;
}
function isFiltering(){ return !!(S.q.trim()||(S.filter&&S.filter!=="all")); }
function buildBody(ctx){
  const names=showNames()?"names":"";
  if(ctx==="photos"){
    let html="";
    /* 文件夹横条也参与搜索：每个文件夹单独做 FLIP（横条容器不设 data-flip） */
    const fl=S.filter==="all"?FOLDERS.filter(f=>matchQ(f.n)):[];   /* R9-04：文件夹横条只跟随「全部」与关键词 */
    const list=filteredItems();
    const shown=list.slice(0,S.limit);   /* §18：首屏 20 项，哨兵再追加 */
    if(fl.length){
      html+=`<div class="sec" data-flip="sec-f"><h3>文件夹</h3><button type="button" data-act="goto-folders">全部 ${ic("chev")}</button></div>`;
      html+=`<div class="folders">${fl.map(f=>fcardHTML(f,false)).join("")}</div>`;
    }
    if(list.length){
      html+=`<div class="sec" data-flip="sec-r"><h3>${S.q.trim()?"文件":"全部文件"}</h3></div>`;
      html+=`<div class="grid ${names}">${shown.map(it=>tileHTML(it,S.select)).join("")}</div>`;
    }
    if(!html) return (isFiltering()?emptySearch():emptyTrue("photos"))+pageEndHTML(ctx,false);
    return html+pageEndHTML(ctx,shown.length<list.length);
  }
  if(ctx==="folder"){
    const all=folderItems();
    const list=all.filter(it=>matchQ(it.name)&&matchF(it));
    const shown=list.slice(0,S.limit);
    if(!list.length) return (all.length||isFiltering()?emptySearch():emptyTrue("folder"))+pageEndHTML(ctx,false);
    return `<div class="grid ${names}" style="padding-top:2px">${shown.map(it=>tileHTML(it,S.select)).join("")}</div>`+pageEndHTML(ctx,shown.length<list.length);
  }
  if(ctx==="folders"){
    let list=FOLDERS.filter(f=>matchQ(f.n));
    if(S.sort==="name") list=[...list].sort((a,b)=>a.n.localeCompare(b.n,"zh"));
    if(S.sort==="count") list=[...list].sort((a,b)=>b.c-a.c);
    const shown=list.slice(0,S.limit);
    if(!list.length) return (FOLDERS.length||S.q.trim()?emptySearch():emptyTrue("folders"))+pageEndHTML(ctx,false);
    return `<div class="fgrid" style="padding-top:8px">${shown.map(f=>fcardHTML(f,S.select)).join("")}</div>`+pageEndHTML(ctx,shown.length<list.length);
  }
  if(ctx==="trash"){
    if(!TRASH.length) return emptyTrue("trash");
    const list=TRASH.filter(t=>matchQ(t.name)&&matchF(t));
    const shown=list.slice(0,S.limit);
    if(!list.length) return emptySearch()+pageEndHTML(ctx,false);
    return `<div class="page"><div class="group">${shown.map(t=>{
      const thumb=t.doc?`<div class="tthumb">${ic("filetext")}</div>`:`<div class="tthumb" data-thumb="${t.id}" style="background-image:${bgFor(ITEMS.find(it=>it.id===t.id))}"></div>`;
      const sel=S.select&&S.sel.has(t.id);
      const lead=`<span class="rsel">${ic("tick")}</span>`; /* 多选圆圈放在右侧（原「恢复 / 删除」位置），进入多选时缩略图与名称不移动 */
      const acts=`<div class="tacts"><button type="button" class="txtbtn" data-restore="${t.id}">恢复</button><button type="button" class="txtbtn danger" data-purge="${t.id}">删除</button></div>`;
      return `<div class="row trow${sel?" sel":""}" data-tid="${t.id}">${thumb}<div class="tmeta"><b>${hl(t.name)}</b><small>${t.days>=9999?"不会自动删除":t.days+" 天后删除"}</small></div>${acts}${lead}</div>`;
    }).join("")}</div><p class="gf">项目将在剩余天数后被永久删除。</p></div>`+pageEndHTML(ctx,shown.length<list.length);
  }
  return settingsBody();
}

/* ===== §18 增量加载：网格末尾的哨兵进入视口时追加下一批（同一时间只跑一批） ===== */
let sentinelObserver=null, loadingBatch=false;
function attachSentinel(){
  if(sentinelObserver) sentinelObserver.disconnect();
  const body=document.getElementById("a-body");
  const sentry=body.querySelector(".page-end");
  if(!sentry||curCtx()==="settings") return;
  const ctx=curCtx();
  if(!hasMore(ctx)) return;
  sentinelObserver=new IntersectionObserver((entries)=>{
    if(!entries.some(e=>e.isIntersecting)) return;
    if(loadingBatch) return;
    const listLen=ctxListLength(ctx);
    if(S.limit>=listLen) return;
    loadingBatch=true; S.limit+=20;
    requestAnimationFrame(()=>{ loadingBatch=false; refreshBody(); });
  },{root:body,rootMargin:"0px 0px 600px 0px"});
  sentinelObserver.observe(sentry);
}
function ctxListLength(ctx){
  if(ctx==="photos") return filteredItems().length;
  if(ctx==="folder") return folderItems().filter(it=>matchQ(it.name)&&matchF(it)).length;
  if(ctx==="folders") return FOLDERS.filter(f=>matchQ(f.n)).length;
  if(ctx==="trash") return TRASH.filter(t=>matchQ(t.name)&&matchF(t)).length;
  return 0;
}
function hasMore(ctx){ return ctxListLength(ctx) > S.limit; }



/* ===== 文档页（§13）：浏览 / 编辑共用一页；内容以 HTML 加密存储 ===== */
let docEditor=null;
function docMetaText(it){
  const d=new Date((it&&it.createdAt)||Date.now());
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function openDoc(id, mode){
  const it=id?ITEMS.find(x=>x.id===id):null;
  S.doc={id, title:it?it.name:"", isNew:!it, mode, sheet:false, html:""};
  S.plus=false; S.search=false;
  const show=()=>{ render(); document.getElementById("a-body").scrollTop=0; };
  if(it){ vault.readDoc(id).then(html=>{ S.doc.html=html||""; if(S.doc&&S.doc.id===id) show(); }).catch(()=>show()); }
  else show();
}
function docBodyHTML(){
  const d=S.doc;
  return `<article class="note">
    <div class="note-meta" id="note-meta">${d.isNew?"":docMetaText(ITEMS.find(x=>x.id===d.id))}</div>
    <div class="note-title" data-ph="标题">${esc(d.title)}</div>
    <div class="note-body" data-ph="开始书写…"></div>
  </article>`;
}
function renderDoc(nav,body,bar,overlay){
  const d=S.doc, edit=d.mode==="edit";
  nav.innerHTML=`<div class="nav-row three"><button type="button" class="back" data-act="doc-back">${ic("chevl")}返回</button><div class="mid"></div>
    <button type="button" class="txtbtn r${edit?" strong":""}" data-act="${edit?"doc-done":"doc-edit"}">${edit?"完成":"编辑"}</button></div>`;
  body.className="scroll notab notepage";
  body.style.paddingBottom=edit&&d.sheet?"300px":"";
  body.innerHTML=docBodyHTML();
  const titleEl=body.querySelector(".note-title");
  const bodyEl=body.querySelector(".note-body");
  const metaEl=document.getElementById("note-meta");
  const paintMeta=()=>{
    const n=(docEditor&&docEditor.isActive?docEditor.getText():bodyEl.textContent||"").replace(/\s/g,"").length;
    metaEl.textContent=(d.isNew?"今天 "+new Date().toTimeString().slice(0,5):docMetaText(ITEMS.find(x=>x.id===d.id)))+` · ${n} 字`;
  };
  if(edit){
    titleEl.setAttribute("contenteditable","true");
    titleEl.oninput=()=>{ d.title=titleEl.textContent.trim(); paintMeta(); };
    docEditor=docEditor||new DocEditor({bodyEl:document.createElement("div"),onChange:paintMeta});
    docEditor.bodyEl=bodyEl;
    docEditor.mount(d.html||"");
    docEditor.editor.on("update",paintMeta);
    if(!d.title) requestAnimationFrame(()=>titleEl.focus());
  }else{
    bodyEl.innerHTML=toBrowseHTML(d.html||"");
    paintMeta();
    docEditor&&docEditor.destroy();
  }
  overlay.innerHTML=""; delete overlay.dataset.plusBuilt; overlay.classList.remove("is-open","closing");
  if(!edit){ bar.hidden=true; return; }
  bar.hidden=false;
  bar.className="etb";
  bar.innerHTML=`
    <button type="button" class="ibtn${d.sheet?" on":""}" data-act="doc-aa" aria-label="文本样式">${ic("aa")}</button>
    <button type="button" class="ibtn" data-fx="task" aria-label="清单">${ic("checks")}</button>
    <button type="button" class="ibtn" data-fx="bullet" aria-label="列表">${ic("list")}</button>
    <button type="button" class="ibtn" data-act="doc-aa" aria-label="颜色">${ic("palette")}</button>
    <button type="button" class="ibtn" data-fx="undo" aria-label="撤销">${ic("undo")}</button>
    <button type="button" class="ibtn" data-fx="redo" aria-label="重做">${ic("redo")}</button>
    <button type="button" class="txtbtn" data-act="doc-done">完成</button>`;
  if(d.sheet){
    overlay.innerHTML=`<div class="fsheet" id="fsheet">
      <div class="fs-head"><b>格式</b><button type="button" class="fs-x" data-act="doc-aa" aria-label="关闭">${ic("x")}</button></div>
      <div class="fs-chips" data-one>
        <button type="button" class="t1" data-fmt="h2">标题</button><button type="button" class="t2" data-fmt="h3">小标题</button>
        <button type="button" class="on" data-fmt="p">正文</button><button type="button" class="mono" data-fmt="mono">等宽</button>
      </div>
      <div class="fs-row">
        <div class="fs-grp" data-multi><button type="button" class="fb" data-mk="bold">B</button><button type="button" class="fi" data-mk="italic">I</button><button type="button" class="fu" data-mk="underline">U</button><button type="button" class="fx" data-mk="strike">S</button></div>
        <div class="fs-grp" data-one-opt><button type="button" data-list="bullet" aria-label="项目符号">${ic("list")}</button><button type="button" data-list="ordered" aria-label="编号">${ic("olist")}</button><button type="button" data-list="task" aria-label="清单">${ic("checks")}</button><button type="button" data-list="indent" aria-label="缩进">${ic("indent")}</button></div>
      </div>
      <div class="fs-size"><span>字号</span><div class="stepper"><button type="button" data-size="-1" aria-label="减小">${ic("minus")}</button><output id="fs-size">17</output><button type="button" data-size="1" aria-label="增大">${ic("plus")}</button></div></div>
      <div class="swatches" data-one>
        <button type="button" class="sw on" data-color="" style="background:var(--text)" aria-label="默认"></button>
        <button type="button" class="sw" data-color="grey" style="background:var(--n-grey)" aria-label="灰色"></button>
        <button type="button" class="sw" data-color="red" style="background:var(--n-red)" aria-label="红色"></button>
        <button type="button" class="sw" data-color="orange" style="background:var(--n-orange)" aria-label="橙色"></button>
        <button type="button" class="sw" data-color="green" style="background:var(--n-green)" aria-label="绿色"></button>
        <button type="button" class="sw" data-color="blue" style="background:var(--n-blue)" aria-label="蓝色"></button>
      </div></div>`;
    overlay.classList.add("is-open");
  }
}
/** 「Aa」面板的选中态与光标处格式同步（不重建面板，避免动画与焦点丢失） */
function syncSheet(){
  if(!docEditor||!docEditor.isActive) return;
  const ed=docEditor.editor;
  document.querySelectorAll("[data-fmt]").forEach(b=>{
    const f=b.dataset.fmt;
    const on=f==="h2"?ed.isActive("heading",{level:2}):f==="h3"?ed.isActive("heading",{level:3}):f==="p"?ed.isActive("paragraph"):ed.isActive("mono");
    b.classList.toggle("on",on);
  });
  for(const k of ["bold","italic","underline","strike"]){
    document.querySelectorAll(`[data-mk="${k}"]`).forEach(b=>b.classList.toggle("on",ed.isActive(k)));
  }
  document.querySelectorAll("[data-list]").forEach(b=>{
    const l=b.dataset.list;
    const on=l==="bullet"?ed.isActive("bulletList"):l==="ordered"?ed.isActive("orderedList"):l==="task"?ed.isActive("taskList"):false;
    b.classList.toggle("on",on);
  });
  const out=document.getElementById("fs-size");
  if(out) out.textContent=Number((ed.getAttributes("fontSize")||{}).size)||17;
  const color=(ed.getAttributes("textColor")||{}).color||"";
  document.querySelectorAll(".swatches .sw").forEach(b=>b.classList.toggle("on",(b.dataset.color||"")===color));
}
/** 保存当前文档（返回 / 完成 / 锁定 / 切页都会调用；空文档不落库） */
function saveDocBeforeLeave(){
  const d=S.doc; if(!d) return null;
  const html=docEditor&&docEditor.isActive?docEditor.getHTML():(d.html||"");
  const title=(document.querySelector(".note-title")||{}).textContent||d.title||"";
  const empty=!String(title).trim()&&!/<(img|ul|ol|h2|h3|p)/.test(html.replace(/<p>\s*<\/p>/g,""));
  if(!d.id){
    if(empty) return null;
    const rec={id:"d"+Date.now().toString(16),kind:"doc",name:String(title).trim()||"未命名文档",mime:"text/html",size:html.length,w:0,h:0,dur:null,createdAt:Date.now(),updatedAt:Date.now(),folderIds:[],trashedAt:null,hasThumb:false};
    vault.saveDoc(rec.id,html).then(()=>vault.saveItem(rec)).then(()=>{ vault.items.unshift(rec); }).catch(saveFail);
    ITEMS.unshift(toUIItem(rec));
    return rec;
  }
  const it=ITEMS.find(x=>x.id===d.id); if(!it) return null;
  it.name=String(title).trim()||it.name;
  it.ref.name=it.name;
  (async()=>{ await vault.saveDoc(it.id,html); await vault.saveItem(it.ref); })().catch(saveFail);
  return it.ref;
}

/* 原地搜索开 / 关（§25）：搜索面板是顶栏下方的覆盖层；打开时给内容区预留同样高度并在同一帧把 scrollTop 加上该高度，
   关闭时反向补偿 —— 网格在屏幕上的位置不变，不播放 FLIP。关闭时若有关键词，直接换回全部内容（无 FLIP）。 */
function updSearchDot(){
  const on=!!S.q.trim(), b=document.querySelector('#a-nav [data-act="toggle-search"]'); if(!b) return;
  const d=b.querySelector(".sdot"); d&&d.classList.toggle("show",on);
  b.setAttribute("aria-label","搜索"+(on?"（正在筛选）":""));
}
/* 多选 ↔ 搜索互斥且先后执行（§39） */
function exitSelect(){ if(!S.select) return; S.select=false; S.sel=new Set(); applySelect(); }
/* R9-06：多选唯一入口；先退出搜索（§39 互斥），长按 / 拖选 / 点多选按钮都走这里 */
function enterSelect(keys){
  if(S.search) toggleSearch();
  if(S.plus) closePlusMenu();
  S.select=true; S.sel=new Set(keys||[]); applySelect();
}
function toggleSearch(){
  const body=document.getElementById("a-body");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(S.plus) closePlusMenu();
  if(!S.search){
    S.search=true; S.searchAnim=true; render({keepBody:true}); S.searchAnim=false;
    const box=document.getElementById("sbox"), H=sboxH();
    { const q=document.getElementById("q"); q&&q.focus({preventScroll:true}); }   /* 在点击手势内同步聚焦，iOS 才会弹出键盘 */
    requestAnimationFrame(()=>{
      if(!S.search) return;
      box.classList.add("open");
      body.style.setProperty("--sbox-h",H+"px");
      /* R11-04：文件夹详情 / 回收站的内容常常不足一屏，scrollTop 补不满 H 的部分由 --sbox-tail 补足可滚动高度（见 sboxTail） */
      const st=body.scrollTop; body.classList.add("reserve"); sboxTail(body,st+H);
      const q=document.getElementById("q"); q&&q.focus({preventScroll:true});
    });
    return;
  }
  /* 收起：保留关键词与筛选结果（§38）；只有关键词为空时才把快捷筛选复位为「全部」，避免无角标的隐藏筛选 */
  const H=sboxH(), hadQuery=!S.q.trim()&&S.filter!=="all";
  S.search=false; if(!S.q.trim()) S.filter="all";
  const box=document.getElementById("sbox");
  const btn=document.querySelector('#a-nav [data-act="toggle-search"]');
  if(btn){ btn.classList.remove("on"); btn.setAttribute("aria-pressed","false"); }
  const q=document.getElementById("q"); q&&q.blur();
  if(hadQuery){ body.innerHTML=buildBody(curCtx()); body.scrollTop=H; if(S.select) S.sel.forEach(k=>markSel(k,true)); }
  box&&box.classList.remove("open");
  const st=body.scrollTop, shift=Math.max(0,H-st);
  body.classList.remove("reserve"); body.style.removeProperty("--sbox-h"); body.style.removeProperty("--sbox-tail"); body.scrollTop=Math.max(0,st-H);
  /* 只有在列表顶部（scrollTop < 面板高度）时，内容会随面板收起同步上移，不是 FLIP */
  if(shift&&!reduce) [...body.children].forEach(el=>el.animate([{transform:`translateY(${shift}px)`},{transform:"none"}],{duration:360,easing:"cubic-bezier(.2,.8,.2,1)"}));
  setTimeout(()=>{ if(!S.search&&S.view==="album"&&!S.doc) render({keepBody:true}); },400);
}

/* 「＋ › 上传图片/视频」打开系统选取器（§24）：选取器打开期间 + 保持按下（×）状态，
   直到 change / cancel、window focus / visibilitychange 回来或用户点任意处才复原。 */
const PICK={openedAt:0,endedAt:0,input:null,off:null};
let reopenPlus=false;
function startPicker(){
  const fab=document.querySelector("#a-bar .fab");
  if(PICK.input) PICK.input.remove();
  const inp=document.createElement("input");
  inp.type="file"; inp.accept="image/*,video/*"; inp.multiple=true; inp.className="picker-input"; inp.tabIndex=-1;
  if(fab){ const r=fab.getBoundingClientRect(); inp.style.left=r.left+"px"; inp.style.top=r.top+"px"; }
  document.body.appendChild(inp); PICK.input=inp;
  S.picking=true; PICK.openedAt=Date.now();
  const t=document.querySelector('#a-bar [data-act="plus"]'); t&&t.setAttribute("aria-expanded","true");
  const later=()=>{ if(Date.now()-PICK.openedAt>400) setTimeout(endPicker,350); };
  const onVis=()=>{ if(document.visibilityState==="visible") later(); };
  const onDown=(e)=>{ if(Date.now()-PICK.openedAt<300) return; endPicker(); };
  inp.addEventListener("change",()=>{ const files=inp.files?[...inp.files]:[]; endPicker(); if(files.length) importFilesReal(files); });
  inp.addEventListener("cancel",()=>endPicker());
  window.addEventListener("focus",later); document.addEventListener("visibilitychange",onVis); document.addEventListener("pointerdown",onDown,true);
  PICK.off=()=>{ window.removeEventListener("focus",later); document.removeEventListener("visibilitychange",onVis); document.removeEventListener("pointerdown",onDown,true); };
  inp.click();        /* 必须在点击手势内同步调用；菜单保持展开、+ 保持 ×（§24/§30） */
}
function endPicker(){
  if(!S.picking) return;
  S.picking=false; PICK.off&&PICK.off(); PICK.off=null;
  privacyUncover();   /* 2.1.2：文件选取器关闭后立刻还原相册（blur 只遮不锁，别让遮罩留在屏幕上） */
  if(S.plus) return;   /* 菜单仍展开：+ 继续保持 × */
  const fab=document.querySelector("#a-bar .fab"); fab&&fab.classList.remove("open");
  const t=document.querySelector('#a-bar [data-act="plus"]'); t&&t.setAttribute("aria-expanded","false");
}
function closePlusMenu(after){
  const overlay=document.getElementById("a-overlay");
  const fab=document.querySelector("#a-bar .fab");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  S.plus=false;
  if(!overlay||!overlay.dataset.plusBuilt){ overlay&&(overlay.innerHTML=""); after&&after(); render(); return; }
  overlay.classList.add("closing");
  overlay.classList.remove("is-open");
  if(!S.picking) fab&&fab.classList.remove("open");
  const done=()=>{
    overlay.innerHTML="";
    delete overlay.dataset.plusBuilt;
    overlay.classList.remove("closing","is-open");
    after&&after();
    render();
  };
  if(reduce) done();
  else setTimeout(done, 220);
}

/* 外观滑块：点选 = 只移动选中块（不重建设置页，过渡才能播放）；按住选中块拖动 = 跟手，松手吸附最近一项 */
/* ===== 通用分段控件（§43）：页面里任何 .seg 都会被自动升级为滑块式——
   插入 .seg-thumb、按 button.on 设置 --i / --n；选中项（.on）无论被谁改变，滑块都会平滑滑过去；
   若整个控件被重新渲染，按上次位置（SEG_POS）从旧位置滑到新位置。 ===== */
const SEG_POS={};
function segKey(sg){ if(sg.id) return "#"+sg.id; if(sg.dataset.kind) return "k:"+sg.dataset.kind; const b=sg.querySelector("button"); return "a:"+(b?[...b.attributes].map(a=>a.name).filter(n=>n.startsWith("data-")).join(","):""); }
function segSync(sg){
  const bs=[...sg.querySelectorAll(":scope>button")]; if(!bs.length) return;
  if(!sg.classList.contains("slide")) sg.classList.add("slide");
  if(!sg.querySelector(":scope>.seg-thumb")){ const t=document.createElement("i"); t.className="seg-thumb"; t.setAttribute("aria-hidden","true"); sg.insertBefore(t,sg.firstChild); }
  const i=Math.max(0,bs.findIndex(b=>b.classList.contains("on"))), key=segKey(sg);
  sg.style.setProperty("--n",bs.length);
  if(!sg._segInit){
    sg._segInit=true;
    const prev=SEG_POS[key];
    if(prev!=null&&prev!==i&&prev<bs.length){ sg.style.setProperty("--i",prev); void sg.offsetWidth; }
  }
  if(sg.style.getPropertyValue("--i")!==String(i)) sg.style.setProperty("--i",i);
  SEG_POS[key]=i;
}
function segScan(root){ (root.querySelectorAll?root:document).querySelectorAll(".seg").forEach(segSync); }
(function(){
  const mo=new MutationObserver(ms=>{
    const set=new Set();
    ms.forEach(m=>{
      if(m.type==="attributes"){ const sg=m.target.parentElement; if(sg&&sg.classList.contains("seg")) set.add(sg); return; }
      m.addedNodes.forEach(n=>{ if(n.nodeType!==1) return; if(n.classList.contains("seg")) set.add(n); n.querySelectorAll&&n.querySelectorAll(".seg").forEach(x=>set.add(x)); });
    });
    set.forEach(segSync);
  });
  const start=()=>{ segScan(document); mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]}); bindSegDrag(); };
  if(document.body) start(); else document.addEventListener("DOMContentLoaded",start);
})();
function segSelect(sg,i){
  const bs=[...sg.querySelectorAll("button")]; if(!bs[i]) return;
  bs.forEach((b,k)=>b.classList.toggle("on",k===i));
  sg.style.setProperty("--i",i);
  const v=bs[i].dataset.themeSet, kind=sg.dataset.kind||"album";
  if((kind==="calc"?S.calcPref:S.albumPref)!==v) setThemePref(kind,v);
}
const SEGD={sg:null,x0:0,i0:0,w:0,moved:false,id:null};
function bindSegDrag(){
  if(document._segd) return; document._segd=true;
  document.addEventListener("pointerdown",e=>{
    const sg=e.target.closest&&e.target.closest(".seg.slide"); if(!sg||e.button>0) return;
    const bs=[...sg.querySelectorAll("button")], i0=bs.findIndex(b=>b.classList.contains("on"));
    if(e.target.closest("button")!==bs[i0]) return;   /* 只有按在选中块上才拖动 */
    Object.assign(SEGD,{sg,x0:e.clientX,i0,w:bs[0].getBoundingClientRect().width+2,moved:false,id:e.pointerId});
  },true);
  document.addEventListener("pointermove",e=>{
    const d=SEGD; if(!d.sg||e.pointerId!==d.id) return;
    const dx=e.clientX-d.x0; if(!d.moved&&Math.abs(dx)<6) return;
    if(!d.moved){ d.moved=true; d.sg.classList.add("dragging"); try{d.sg.setPointerCapture(e.pointerId)}catch(_){} }
    const n=d.sg.querySelectorAll("button").length, px=Math.max(0,Math.min((n-1)*d.w,d.i0*d.w+dx));
    d.sg.style.setProperty("--dx",px+"px");
    const near=Math.round(px/d.w); d.sg.querySelectorAll("button").forEach((b,k)=>b.classList.toggle("on",k===near));
  },true);
  const up=e=>{
    const d=SEGD; if(!d.sg||e.pointerId!==d.id) return;
    const sg=d.sg; d.sg=null;
    if(!d.moved) return;
    const near=[...sg.querySelectorAll("button")].findIndex(b=>b.classList.contains("on"));
    sg.style.setProperty("--i",near);
    const nb=sg.querySelectorAll("button")[near];
    SEG_POS[segKey(sg)]=near;
    if(nb&&nb.dataset.themeSet!==undefined) requestAnimationFrame(()=>{ sg.classList.remove("dragging"); segSelect(sg,near); });
    else { requestAnimationFrame(()=>sg.classList.remove("dragging")); SEGD.prog=true; nb&&nb.click(); SEGD.prog=false; }
    SEGD.swallow=Date.now();
  };
  document.addEventListener("pointerup",up,true); document.addEventListener("pointercancel",up,true);
  document.addEventListener("click",e=>{ if(!SEGD.prog&&SEGD.swallow&&Date.now()-SEGD.swallow<350&&e.target.closest&&e.target.closest(".seg.slide")){ e.stopPropagation(); e.preventDefault(); SEGD.swallow=0; } },true);
}

/* §60 左缘右滑返回（iOS 风格）：起点在左缘 ~20px，右滑达阈值或速度阈值后执行与点 ‹ 相同动作。
   非长按后滑动；对话框/进度遮罩打开时不触发；中屏横向拖仍留给多选拖选。
   相册内子页（文件夹/设置子页/文档）与 ‹ 共用 navBack*，且禁止跟手平移 #v-album——
   整壳滑走会露底（虚空/计算器伪装），表现为「右滑退出到计算器封面」。
   详情页查看器内横滑已改作翻页（R10-04），不再跟手滑出、也不关闭，退出只用左上「返回」。 */
function navBackFolder(){ S.folder=null; resetModes(); render(); }
function navBackSub(){ S.sub=null; render(); }
function navBackDoc(){ S.doc=null; if(S.plusResume){ S.plusResume=false; S.plus=true; reopenPlus=true; } render(); reopenPlus=false; }
function navBackViewer(viewer){
  const v=viewer||document.querySelector("#layer>.viewer"); if(!v) return;
  const b=v.querySelector('[data-x="back"]');
  if(b) b.click();
  else { try{v._player&&v._player.destroy()}catch(_){} v.remove(); }
}
const EB={on:false,id:null,x0:0,y0:0,t0:0,dx:0,panel:null,act:null,moved:false};
const EB_EDGE=20, EB_ARM=8, EB_COMMIT=56, EB_VEL=0.45;
function edgeBackBlocked(){
  return !!document.querySelector(".dlg-back.show");
}
function edgeBackTarget(){
  if(S.view!=="album") return null;
  if(edgeBackBlocked()) return null;
  const viewer=document.querySelector("#layer>.viewer");
  /* R10-04：详情页内横向滑动一律用于翻页，取消该页左缘右滑返回（退出只用左上「返回」） */
  if(viewer) return null;
  /* el:null → 不跟手平移 #v-album（避免整壳滑出露计算器底）；act 与顶栏 ‹ 同函数 */
  if(S.doc) return {el:null, act:navBackDoc};
  if(S.sub) return {el:null, act:navBackSub};
  if(S.folder) return {el:null, act:navBackFolder};
  return null;
}
function ebResetVisual(el){
  if(!el) return;
  el.classList.remove("edge-back-dragging");
  el.style.transition=""; el.style.transform=""; el.style.opacity=""; el.style.boxShadow="";
}
function ebFollow(el,dx){
  if(!el) return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x=Math.max(0,dx);
  el.classList.add("edge-back-dragging");
  el.style.transition="none";
  el.style.transform="translate3d("+x+"px,0,0)";
  el.style.opacity=String(Math.max(0.55, 1-x/420));
}
function bindEdgeBack(){
  if(document._eb) return; document._eb=true;
  document.addEventListener("pointerdown",e=>{
    if(EB.on) return;
    if(e.button>0) return;
    if(e.clientX>EB_EDGE) return;
    if(e.target.closest&&e.target.closest("input,textarea,[contenteditable],.dlg-back,.plyr__controls,.plyr__menu")) return;
    const t=edgeBackTarget(); if(!t) return; /* el 可为 null（相册内子页无跟手壳） */
    EB.on=true; EB.id=e.pointerId; EB.x0=e.clientX; EB.y0=e.clientY; EB.t0=performance.now();
    EB.dx=0; EB.panel=t.el||null; EB.act=t.act; EB.moved=false;
    clearTimeout(LP.timer); LP.timer=0;
    DS.track=false; DS.armed=false; /* 左缘不交给拖选 */
  },{capture:true,passive:true});
  document.addEventListener("pointermove",e=>{
    if(!EB.on||e.pointerId!==EB.id) return;
    if(edgeBackBlocked()){ ebCancel(); return; }
    const dx=e.clientX-EB.x0, dy=e.clientY-EB.y0;
    if(!EB.moved){
      if(Math.hypot(dx,dy)<EB_ARM) return;
      if(Math.abs(dy)>Math.abs(dx)*1.15 || dx<=2){ ebCancel(); return; } /* 竖滑/左滑放弃 */
      EB.moved=true;
      try{ document.body.setPointerCapture(e.pointerId); }catch(_){}
    }
    EB.dx=Math.max(0,dx);
    if(e.cancelable) e.preventDefault();
    ebFollow(EB.panel, EB.dx);
  },{capture:true,passive:false});
  /* 浏览器（Chrome / iOS Safari）在同一手势被判成滚动时会派发 pointercancel，边缘返回就断了。
     补一道 touchmove 守卫：方向一旦判定为「左缘横滑」，就 preventDefault() 让浏览器不再接管这次触摸；
     竖向 / 左滑不拦（照常原生滚动）。判定阈值与下面 pointermove 完全一致。 */
  document.addEventListener("touchmove",e=>{
    if(!EB.on||e.touches.length!==1) return;
    const t=e.touches[0], dx=t.clientX-EB.x0, dy=t.clientY-EB.y0;
    if(Math.hypot(dx,dy)<EB_ARM) return;
    if(Math.abs(dy)>Math.abs(dx)*1.15||dx<=2) return;
    if(e.cancelable) e.preventDefault();
  },{capture:true,passive:false});
  function ebCancel(){
    const panel=EB.panel, moved=EB.moved;
    EB.on=false; EB.id=null; EB.act=null;
    if(panel&&moved){
      panel.style.transition="transform .22s cubic-bezier(.2,.9,.3,1), opacity .22s ease";
      panel.style.transform=""; panel.style.opacity="";
      setTimeout(()=>ebResetVisual(panel),240);
    } else ebResetVisual(panel);
    EB.panel=null; EB.moved=false;
  }
  function ebEnd(e){
    if(!EB.on||(e&&e.pointerId!=null&&e.pointerId!==EB.id)) return;
    const dt=Math.max(1, performance.now()-EB.t0);
    const vel=EB.dx/dt;
    const commit=EB.moved && (EB.dx>=EB_COMMIT || (EB.dx>28 && vel>=EB_VEL));
    const panel=EB.panel, act=EB.act, moved=EB.moved;
    EB.on=false; EB.id=null; EB.panel=null; EB.act=null; EB.moved=false;
    if(!commit){
      if(panel&&moved){
        panel.style.transition="transform .22s cubic-bezier(.2,.9,.3,1), opacity .22s ease";
        panel.style.transform=""; panel.style.opacity="";
        setTimeout(()=>ebResetVisual(panel),240);
      } else ebResetVisual(panel);
      return;
    }
    const finish=()=>{ ebResetVisual(panel); try{ act&&act(); }catch(_){} };
    if(panel&&moved&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      const w=Math.max(panel.clientWidth||innerWidth, 280);
      panel.style.transition="transform .18s ease-out, opacity .18s ease-out";
      panel.style.transform="translate3d("+Math.max(EB.dx, w*0.42)+"px,0,0)";
      panel.style.opacity="0.3";
      setTimeout(finish,170);
    } else finish();
  }
  document.addEventListener("pointerup",ebEnd,{capture:true});
  document.addEventListener("pointercancel",ebEnd,{capture:true});
  window.__edgeBack={EB, edgeBackTarget, edgeBackBlocked, EB_EDGE, EB_COMMIT, navBackFolder, navBackSub, navBackDoc}; /* 验收用 */
}

function bindAlbum(){
  bindSegDrag();
  const root=document.getElementById("v-album");
  root.onclick=function(e){
    if(LP.suppress){ LP.suppress=false; e.preventDefault(); e.stopPropagation(); return; }
    /* 多选中点文件区域以外的地方 = 退出多选（§42）。例外：顶栏按钮、多选栏、Tab 栏、＋菜单、弹窗 */
    if(S.select&&!S.doc&&curCtx()!=="settings"){
      const ctx=curCtx();
      const inBody=e.target.closest("#a-body"), inNav=e.target.closest("#a-nav");
      const isTile=e.target.closest(ctx==="folders"?"#a-body [data-folder]":ctx==="trash"?"#a-body [data-tid]":"#a-body .grid [data-id]");
      const isPageEnd=e.target.closest(".page-end");
      if((inBody&&!isTile&&!isPageEnd)||(inNav&&!e.target.closest("button,input,#sbox"))){ e.preventDefault(); e.stopPropagation(); exitSelect(); return; }
    }
    /* ---- 文档编辑：工具条与「Aa」格式面板（§13） ---- */
    const fxEl=e.target.closest("[data-fx]");
    if(fxEl&&docEditor&&docEditor.isActive){
      const fx=fxEl.dataset.fx;
      if(fx==="task") docEditor.command(c=>c.toggleTaskList());
      else if(fx==="bullet") docEditor.command(c=>c.toggleBulletList());
      else if(fx==="undo") docEditor.command(c=>c.undo());
      else if(fx==="redo") docEditor.command(c=>c.redo());
      return;
    }
    const fmtEl=e.target.closest("[data-fmt]");
    if(fmtEl&&docEditor&&docEditor.isActive){
      const f=fmtEl.dataset.fmt;
      if(f==="h2") docEditor.command(c=>c.toggleHeading({level:2}));
      else if(f==="h3") docEditor.command(c=>c.toggleHeading({level:3}));
      else if(f==="p") docEditor.command(c=>c.setParagraph());
      else if(f==="mono") docEditor.toggleMono();
      syncSheet(); return;
    }
    const mkEl=e.target.closest("[data-mk]");
    if(mkEl&&docEditor&&docEditor.isActive){
      const m=mkEl.dataset.mk;
      docEditor.command(c=>m==="bold"?c.toggleBold():m==="italic"?c.toggleItalic():m==="underline"?c.toggleUnderline():c.toggleStrike());
      syncSheet(); return;
    }
    const listEl=e.target.closest("[data-list]");
    if(listEl&&docEditor&&docEditor.isActive){
      const l=listEl.dataset.list;
      if(l==="bullet") docEditor.command(c=>c.toggleBulletList());
      else if(l==="ordered") docEditor.command(c=>c.toggleOrderedList());
      else if(l==="task") docEditor.command(c=>c.toggleTaskList());
      else if(l==="indent") docEditor.command(c=>c.sinkListItem("listItem"));
      syncSheet(); return;
    }
    const szEl=e.target.closest("[data-size]");
    if(szEl&&docEditor&&docEditor.isActive){
      const v=docEditor.stepSize(+szEl.dataset.size);
      const out=document.getElementById("fs-size"); if(out&&v) out.textContent=v;
      return;
    }
    const colEl=e.target.closest("[data-color]");
    if(colEl&&docEditor&&docEditor.isActive){
      docEditor.setColor(colEl.dataset.color||"");
      document.querySelectorAll(".swatches .sw").forEach(x=>x.classList.toggle("on",x===colEl));
      return;
    }
    const rt=e.target.closest("[data-ret]");
    if(rt){
      S.retention=rt.dataset.ret;
      vault.saveSettings({retention:S.retention}).catch(saveFail);
      refreshTrashDays();
      render(); return;
    }
    const al=e.target.closest("[data-autolock]");
    if(al){
      S.autoLock=al.dataset.autolock;
      vault.saveSettings({autoLock:S.autoLock}).catch(saveFail);
      armAutoLock();
      render(); return;
    }
    /* R10-09：「幻灯片间隔」子页选项，写法同「回收站保留时间」 */
    const si=e.target.closest("[data-slideint]");
    if(si){
      S.slideInt=si.dataset.slideint;
      vault.saveSettings({slideInt:S.slideInt}).catch(saveFail);
      render(); return;
    }
    const t=e.target.closest("[data-act],[data-tab],[data-theme-set],[data-filter],[data-sort],[data-folder],[data-id],[data-tid],[data-restore],[data-purge]");
    if(!t) return;
    if(t.dataset.themeSet!==undefined){ const sg=t.closest(".seg.slide"); if(sg){ segSelect(sg,[...sg.querySelectorAll("button")].indexOf(t)); return; } setThemePref(t.dataset.kind||"album", t.dataset.themeSet); render(); return; }
    if(t.dataset.tab){ S.tab=t.dataset.tab; S.plus=false; S.folder=null; S.sub=null; resetModes(); render(); return; }
    if(t.dataset.filter){ S.filter=t.dataset.filter; refreshBody(); return; }
    if(t.dataset.sort){ S.sort=t.dataset.sort; refreshBody(); return; }
    if(t.dataset.folder){
      if(S.select&&curCtx()==="folders"){ toggleSel(t.dataset.folder); return; }
      S.folder=t.dataset.folder; S.plus=false; resetModes(); render(); return;
    }
    if(t.dataset.tid){ if(S.select) toggleSel(t.dataset.tid); return; }
    if(t.dataset.restore){
      const id=t.dataset.restore;
      const item=ITEMS.find(x=>x.id===id);
      if(!item) return;
      vault.restoreItems([id]).catch(saveFail);
      item.trash=false; item.trashedAt=null; item.ref.trashedAt=null;
      refreshFolderCards();
      refreshTrashDays(); toast("已恢复"); render();
      return;
    }
    if(t.dataset.purge){
      const id=t.dataset.purge;
      dialog({title:"永久删除？", text:"删除后无法恢复", ok:"删除", danger:true, onOk:async ()=>{
        await purgeWithUi([id], {toastText:"已删除"});
        refreshTrashDays(); render();
      }});
      return;
    }
    if(t.dataset.id){
      const id=t.dataset.id;
      if(S.select){ toggleSel(id); } else {
        const it=ITEMS.find(x=>x.id===id);
        if(it&&it.doc) openDoc(id,"view"); else openViewer(id);
      }
      return;
    }
    const act=t.dataset.act;
    if(!act) return;
    if(act==="lock"){ lock(); return; }
    if(act==="back"){ S.tab="photos"; render(); return; }
    if(act==="doc-back"){ if(S.doc&&S.doc.mode==="edit") saveDocBeforeLeave(); navBackDoc(); return; }
    if(act==="doc-edit"){ S.doc.mode="edit"; render(); return; }
    if(act==="doc-done"){
      const html=docEditor&&docEditor.isActive?docEditor.getHTML():(S.doc.html||"");
      const rec=saveDocBeforeLeave();
      S.doc.html=html; S.doc.mode="view"; S.doc.sheet=false; S.doc.isNew=false;
      if(rec&&!S.doc.id) S.doc.id=rec.id;
      docEditor&&docEditor.destroy();
      toast("已保存"); render(); return;
    }
    if(act==="doc-aa"){ S.doc.sheet=!S.doc.sheet; render(); return; }
    if(act==="open-pin"){
      S.sub="pin"; render();
      /* 2.1.2：当前仍是旧短码（4–5 位）时，在修改页用 toast 温和提示升级到 6–9 位（不加 DOM、不改布局） */
      if(pinIsShort) toast("当前解锁码为旧短码（4–5 位），建议改为 6–9 位");
      return;
    }
    if(act==="save-pin"){
      const cur=(document.getElementById("pin-cur")||{}).value||"";
      const nw=(document.getElementById("pin-new")||{}).value||"";
      const cf=(document.getElementById("pin-cf")||{}).value||"";
      const showErr=(msg,row)=>{ const er=document.getElementById("pin-err"); if(er){ er.textContent=msg; er.hidden=false; } ["fr-cur","fr-new","fr-cf"].forEach(id=>{ const el=document.getElementById(id); el&&el.classList.toggle("err",id===row); }); };
      if(!PIN_RE.test(cur)){ showErr("请输入当前解锁码","fr-cur"); return; }
      if(!NEW_PIN_RE.test(nw)){ showErr("新解锁码须为 6–9 位数字","fr-new"); return; }
      if(nw!==cf){ showErr("两次输入不一致","fr-cf"); return; }
      vault.changePin(cur,nw).then(()=>{
        pinIsShort=false; pinShortHinted=false;   /* 已是 6–9 位新码，短码提示不再需要 */
        S.sub=null; render(); toast("解锁码已修改");
      }).catch(err=>{
        showErr(err.message==="解锁码不正确"?"解锁码不正确":"修改失败，请重试","fr-cur");
      });
      return;
    }
    if(act==="ver-check"){ checkUpdate(true); return; }
    if(act==="ver-update"||act==="ver-retry"){ promptUpdate(); return; }
    if(act==="clear-all"){
      dialog({title:"清空全部数据？", text:"将永久删除本机全部文件、文件夹与回收站内容，且无法恢复。此操作与紧急清除码无关。", ok:"清空", danger:true, onOk:async ()=>{
        try{
          await vault.clearContent();
          media.clear();
          hydrate();
          S.select=false; S.sel=new Set(); S.folder=null; S.q=""; S.filter="all"; S.limit=20;
          render(); toast("已清空全部数据");
        }catch(err){ saveFail(err); }
      }}); return; }
    if(act==="toggle-page-end"){ S.pageEnd=S.pageEnd==="loading"?"done":"loading"; refreshBody(); return; }
    if(act==="sel-toggle-all"){ const ids=selectableIds(); S.sel=(ids.length&&S.sel.size>=ids.length)?new Set():new Set(ids); applySelect(); return; }
    if(act==="open-retention"){ S.sub="retention"; render(); return; }
    if(act==="open-autolock"){ S.sub="autolock"; render(); return; }
    if(act==="open-slideint"){ S.sub="slideint"; render(); return; }   /* R10-09：设置「显示」分组 → 幻灯片间隔子页 */
    if(act==="empty-trash"){
      const n=TRASH.length; if(!n) return;
      dialog({title:"清空回收站？", text:`将永久删除全部 ${n} 个文件，无法恢复`, ok:"清空", danger:true, onOk:async ()=>{
        const ids=ITEMS.filter(it=>it.trash).map(it=>it.id);
        await purgeWithUi(ids, {toastText:"已清空"});
        S.select=false; S.sel=new Set(); refreshTrashDays(); render();
      }});
      return;
    }
    if(act==="open-wipe"){ verifyUnlockPin(()=>{ S.sub="wipe"; render(); }); return; }
    if(act==="save-wipe"){
      const c1=(document.getElementById("wipe-code")||{}).value||"";
      const c2=(document.getElementById("wipe-code2")||{}).value||"";
      const showErr=(msg,row)=>{ const er=document.getElementById("wipe-err"); if(er){ er.textContent=msg; er.hidden=false; } ["fr-wipe","fr-wipe2"].forEach(id=>{ const el=document.getElementById(id); el&&el.classList.toggle("err",id===row); }); };
      if(!NEW_PIN_RE.test(c1)){ showErr("请输入 6–9 位数字","fr-wipe"); return; }
      if(c1!==c2){ showErr("两次输入不一致","fr-wipe2"); return; }
      verifyUnlockPin(async ()=>{
        try{
          await vault.setWipeCode(c1);
          S.wipeOn=true; toast("紧急清除码已保存"); S.sub=null; render();
        }catch(err){ showErr(err.message||"保存失败","fr-wipe"); }
      });
      return;
    }
    if(act==="disable-wipe"){
      dialog({title:"关闭紧急清除？", text:"关闭后，在首页输入该码并点击计算不会再清除本机内容。", ok:"关闭", danger:true, onOk:async ()=>{
        await vault.disableWipeCode(); S.wipeOn=false; toast("已关闭紧急清除"); render();
      }});
      return;
    }
    if(act==="back-sub"){ navBackSub(); return; }
    if(act==="rename-folder"){ renameFolder(S.folder); return; }
    if(act==="back-folder"){ navBackFolder(); return; }
    if(act==="slideshow"){   /* R10-05：文件夹顶栏「播放」→ 幻灯片；多选中点它先退出多选再开始 */
      if(S.select) exitSelect();
      const ids=slideshowIds();
      if(!ids.length){ toast("没有可播放的照片或视频"); return; }
      openViewer(ids[0],{slideshow:true});
      return;
    }
    /* 搜索与多选互斥，切换时两个动画同时进行（§39 第四轮修订） */
    if(act==="toggle-search"){ if(!S.search&&S.select) exitSelect(); toggleSearch(); return; }
    if(act==="clear-q"){ S.q=""; const q=document.getElementById("q"); if(q){ q.value=""; q.focus(); } const c=document.querySelector("#sbox .clr"); if(c) c.classList.remove("show"); updSearchDot(); refreshBody(); return; }
    if(act==="toggle-select"){
      if(!S.select){ enterSelect(); return; }
      S.select=false; S.sel=new Set(); if(S.plus) closePlusMenu(); applySelect(); return; }
    if(act==="sel-rename"){
      if(S.sel.size!==1) return;
      const id=[...S.sel][0], ctx=curCtx();
      if(ctx==="folders"){ renameFolder(id); return; }
      if(ctx==="folder"){
        renameSelected(id);
        return;
      }
      renameSelected(id); return;
    }
    if(act==="sel-export"){ if(S.sel.size) exportSelected([...S.sel]); return; }
    if(act==="sel-addf"){ if(S.sel.size) openFolderPicker(); return; }
    if(act==="sel-out"){
      const n=S.sel.size, f=FOLDERS.find(x=>x.id===S.folder); if(!n||!f) return;
      dialog({title:`从「${f.n}」移出 ${n} 项？`, text:"只移出此文件夹，文件不会被删除，仍可在首页和其他文件夹中找到", ok:"移出", onOk:()=>{
        const ids=[...S.sel];
        vault.setFolders(ids,[],[S.folder]).then(()=>{
          ids.forEach(id=>{ const it=ITEMS.find(x=>x.id===id); if(it) it.folderIds.delete(S.folder); });
          refreshFolderCards(); render();
        }).catch(saveFail);
        S.sel=new Set(); render(); toast(`已移出 ${n} 项`);
      }});
      return;
    }
    if(act==="sel-del"){
      if(curCtx()==="photos"){ const n=S.sel.size; if(!n) return;
        dialog({title:`删除 ${n} 项？`, text:`将移入回收站，${S.retention==="never"?"可随时":S.retention+" 天内可"}恢复`, ok:"删除", danger:true, onOk:()=>deleteSelected()});
        return; }
      const n=S.sel.size;
      const ctx=curCtx();
      dialog({title:ctx==="folders"?`删除 ${n} 个文件夹？`:`删除 ${n} 项？`, text:ctx==="folders"?"只删除文件夹，里面的文件仍保留在首页和其他文件夹中，不会进回收站":`将移入回收站，${S.retention==="never"?"可随时":S.retention+" 天内可"}恢复`, ok:"删除", danger:true, onOk:()=>{
        const ids=[...S.sel];
        if(ctx==="folders"){
          vault.deleteFolders(ids).catch(saveFail);
          FOLDERS=FOLDERS.filter(f=>!ids.includes(f.id));
          ITEMS.forEach(it=>{ let touched=false; ids.forEach(id=>{ if(it.folderIds.delete(id)) touched=true; }); if(touched) it.ref.folderIds=[...it.folderIds]; });
        }else{
          deleteSelected();
          return;
        }
        S.sel=new Set(); render(); toast("已删除");
      }});
      return;
    }
    if(act==="sel-restore"){
      const ids=[...S.sel];
      vault.restoreItems(ids).catch(saveFail);
      ids.forEach(id=>{ const it=ITEMS.find(x=>x.id===id); if(it){ it.trash=false; it.trashedAt=null; it.ref.trashedAt=null; } });
      refreshFolderCards();
      S.sel=new Set(); refreshTrashDays(); render(); toast("已恢复"); return;
    }
    if(act==="sel-purge"){
      const n=S.sel.size, ids=[...S.sel];
      dialog({title:`永久删除 ${n} 项？`, text:"删除后无法恢复", ok:"删除", danger:true, onOk:async ()=>{
        await purgeWithUi(ids, {toastText:"已删除"});
        refreshTrashDays(); S.sel=new Set(); render();
      }});
      return;
    }
    if(act==="plus"){ if(S.picking) endPicker(); if(S.plus) closePlusMenu(); else { S.plus=true; render(); } return; }
    /* 菜单内三个按钮都不收起菜单（§30）：只有点遮罩或再点 × 才收起 */
    if(act==="add-photo"){ startPicker(); return; }
    if(act==="close-plus"){ closePlusMenu(); return; }
    if(act==="add-folder"){ dialog({title:"新建文件夹", input:{value:"", placeholder:"文件夹名称"}, ok:"创建", onOk:async (v)=>{
        if(!v.trim()) return "名称不能为空";
        try{
          const rec=await vault.createFolder(v.trim());
          FOLDERS.push({id:rec.id,n:rec.n,s:[],c:0,ref:rec});
          render({keepBody:false}); toast("已创建");
        }catch(err){ saveFail(err); return "创建失败"; }
      }}); return; }
    if(act==="add-doc"){ S.plusResume=true; S.plus=false; S.doc={id:null,title:"",isNew:true,mode:"edit",sheet:false}; render(); document.getElementById("a-body").scrollTop=0; return; }
    if(act==="goto-folders"){ S.tab="folders"; render(); return; }
    if(act==="toggle-names"){ S.showNames=!S.showNames; vault.saveSettings({showNames:S.showNames}).catch(saveFail); render(); return; }
    if(act==="share"||act==="move"){ toast("演示：功能占位"); return; }
    if(act==="noop"){ toast("演示：功能占位"); return; }
  };
  bindLongPress(root);
  bindDragSelect();
  bindEdgeBack();
  const q=document.getElementById("q");
  if(q){
    q.oninput=function(){ S.q=q.value; const c=document.querySelector("#sbox .clr"); if(c) c.classList.toggle("show",!!S.q); updSearchDot(); refreshBody(); };
  }
}

function splitName(name){
  const i=name.lastIndexOf(".");
  if(i>0) return {base:name.slice(0,i), ext:name.slice(i)};
  return {base:name, ext:""};
}

function renameFolder(id){
  const f=FOLDERS.find(x=>x.id===id); if(!f) return;
  dialog({title:"重命名文件夹", input:{value:f.n}, ok:"确定", onOk:(v)=>{
    if(!v.trim()) return "名称不能为空";
    f.n=v.trim(); f.ref.n=f.n;
    vault.saveFolder(f.ref).catch(saveFail);
    render(); toast("已重命名");
  }});
}
function renameSelected(id){
  const it=ITEMS.find(x=>x.id===id)||null;
  if(!it) return;
  const {base,ext}=splitName(it.name);
  prompt2("重命名", base, ext, (val)=>{
    if(!val.trim()) return "名称不能为空";
    it.name=val.trim()+ext;
    persistItem(it);          /* 写库：翻到别的文件再翻回来仍是新名字 */
    toast("已重命名");
    render();
    return true;
  });
}

/** 移入回收站（先确认，§33）：内存与存储同时更新 */
function deleteSelected(){
  const ids=[...S.sel];
  const list=ITEMS.filter(it=>ids.includes(it.id)&&!it.trash);
  if(list.length){
    const stamp=Date.now();
    list.forEach(it=>{ it.trash=true; it.trashedAt=stamp; it.ref.trashedAt=stamp; });
    vault.trashItems(list.map(it=>it.id)).catch(saveFail);
    refreshFolderCards();
    refreshTrashDays();
  }
  S.sel=new Set();
  toast("已移入回收站");
  render();
}

/* 统一对话框组件。opts: {title, text?, input?:{value, suffix?, placeholder?}, cancel?="取消", ok?="确定", danger?, onOk(value)}
   onOk 返回字符串 = 行内错误（对话框保持打开）；其它返回值 = 关闭。 */
function verifyUnlockPin(onPass){
  dialog({
    title:"验证解锁码",
    text:"请输入当前解锁码以继续",
    input:{value:"", placeholder:"当前解锁码", type:"password", inputmode:"numeric", pattern:"[0-9]*", maxlength:"9", autocomplete:"off"},
    ok:"继续",
    onOk:async (v)=>{
      const str=String(v||"").trim();
      if(!PIN_RE.test(str)) return "请输入 4–9 位数字";
      if(!(await vault.verifyPin(str))) return "解锁码不正确";
      onPass&&onPass();
    }
  });
}

function dialog(opts){
  const layer=document.getElementById("layer");
  const wrap=document.createElement("div");
  wrap.className="dlg-back";
  const inp=opts.input;
  const itype=inp&&inp.type?inp.type:"text";
  const iattrs=inp?` type="${esc(itype)}" value="${esc(inp.value||"")}" placeholder="${esc(inp.placeholder||"")}" autocomplete="${esc(inp.autocomplete||"off")}"${inp.inputmode?` inputmode="${esc(inp.inputmode)}"`:""}${inp.pattern?` pattern="${esc(inp.pattern)}"`:""}${inp.maxlength?` maxlength="${esc(String(inp.maxlength))}"`:""}`:"";
  wrap.innerHTML=`<div class="dlg${inp?"":" noinput"}" role="alertdialog" aria-modal="true"><h4>${esc(opts.title)}</h4>
    ${opts.text?`<p${/\n/.test(opts.text)?` style="white-space:pre-wrap;text-align:left;font-size:12px;line-height:1.45"`:""}>${esc(opts.text)}</p>`:""}
    ${inp?`<div class="din"><input id="dlg-in"${iattrs}>${inp.suffix?`<span>${esc(inp.suffix)}</span>`:""}</div>
    <div class="derr" id="dlg-err"></div>`:""}
    <div class="dbtns"><button type="button" data-x="c">${esc(opts.cancel||"取消")}</button><button type="button" data-x="o" class="${opts.danger?"danger":""}">${esc(opts.ok||"确定")}</button></div></div>`;
  layer.appendChild(wrap);
  requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add("show")));
  const el=wrap.querySelector("#dlg-in");
  if(el){ el.focus(); el.select(); }
  /* 关闭时立刻摘掉事件处理：淡出动画保留，但淡出中的弹窗不能再被点击触发（防重复提交） */
  const close=(cancelled)=>{ wrap.style.pointerEvents="none"; wrap.onclick=null; wrap.onpointerdown=null; wrap.classList.remove("show"); setTimeout(()=>wrap.remove(),180); if(cancelled&&opts.onCancel) opts.onCancel(); };
  /* 点遮罩（按下与松开都在遮罩上）= 取消（§45）；叠放时只关闭最上层 */
  let downOnBack=false;
  wrap.onpointerdown=e=>{ downOnBack=e.target===wrap; };
  wrap.onclick=(e)=>{
    if(e.target===wrap){ if(downOnBack) close(true); downOnBack=false; return; }
    const b=e.target.closest("[data-x]");
    if(!b) return;
    if(b.dataset.x==="c"){ close(true); return; }
    const r=opts.onOk?opts.onOk(el?el.value:undefined):undefined;
    const settle=(v)=>{
      if(typeof v==="string"){ const er=wrap.querySelector("#dlg-err"); if(er) er.textContent=v; else toast(v); return; }
      close();
    };
    /* onOk 可以是异步（验证解锁码要跑一次 PBKDF2）：返回字符串 = 行内错误，其余 = 关闭 */
    if(r&&typeof r.then==="function"){
      b.disabled=true;
      r.then(v=>{ b.disabled=false; settle(v); }).catch(()=>{ b.disabled=false; settle("操作失败，请重试"); });
      return;
    }
    settle(r);
  };
  return wrap;
}
/* 「加入文件夹」选择框（§31）：屏幕正中固定尺寸弹窗，动画同 dialog；多选（含半选态）、框内滚动、可展开搜索、顶部「新建文件夹」 */
function openFolderPicker(){
  const ids=[...S.sel], n=ids.length;
  const init={};   /* folderId -> "all" | "some" | "none" */
  FOLDERS.forEach(f=>{ const k=ids.filter(id=>memOf(id).has(f.id)).length; init[f.id]=k===0?"none":k===n?"all":"some"; });
  const cur=Object.assign({},init);
  let q="", searchOpen=false;
  const layer=document.getElementById("layer");
  const wrap=document.createElement("div");
  wrap.className="dlg-back fp-back";
  wrap.innerHTML=`<div class="dlg fpk" role="dialog" aria-modal="true" aria-labelledby="fp-t">
    <div class="fp-head"><div class="fp-tt"><h4 id="fp-t">加入文件夹</h4><small>已选 ${n} 项 · 可多选</small></div>
      <button type="button" class="fp-sbtn" data-x="s" aria-label="搜索文件夹" aria-expanded="false">${ic("search")}<i class="sdot" aria-hidden="true"></i></button></div>
    <div class="fp-sbox"><div><div class="field">${ic("search")}<input id="fp-q" type="search" placeholder="搜索文件夹" autocomplete="off" enterkeyhint="search"><button type="button" class="clr" data-x="clr" aria-label="清除"><span>${ic("x")}</span></button></div></div></div>
    <div class="fp-list" id="fp-list"></div>
    <div class="dbtns"><button type="button" data-x="c">取消</button><button type="button" data-x="o">确认</button></div></div>`;
  layer.appendChild(wrap);
  const list=wrap.querySelector("#fp-list"), inp=wrap.querySelector("#fp-q"), clr=wrap.querySelector(".clr");
  const fhl=name=>{ const t=q.trim(); if(!t) return esc(name); const i=name.toLowerCase().indexOf(t.toLowerCase()); if(i<0) return esc(name); return esc(name.slice(0,i))+`<mark class="hl">${esc(name.slice(i,i+t.length))}</mark>`+esc(name.slice(i+t.length)); };
  const thumb=f=>{ const id=(f.s||[]).find(i=>{ const it=ITEMS.find(x=>x.id===i); return it&&!it.trash&&!it.doc; }); return id?`<span class="fp-th" data-thumb="${id}" style="background-image:${bgFor(ITEMS.find(it=>it.id===id))}"></span>`:`<span class="fp-th empty">${ic("folder")}</span>`; };
  const draw=()=>{
    const t=q.trim().toLowerCase();
    const rows=FOLDERS.filter(f=>!t||f.n.toLowerCase().includes(t));
    list.innerHTML=(t?"":`<button type="button" class="fp-row fp-new" data-x="new"><span class="fp-th add">${ic("plus")}</span><span class="fp-n">新建文件夹</span></button>`)+
      rows.map(f=>{ const st=cur[f.id];
        return `<button type="button" class="fp-row" data-f="${f.id}" role="checkbox" aria-checked="${st==="all"?"true":st==="some"?"mixed":"false"}">${thumb(f)}<span class="fp-n"><b>${fhl(f.n)}</b><small>${f.c} 项${f.id===S.folder?" · 当前文件夹":""}</small></span><span class="fp-ck ${st}">${st==="all"?ic("tick"):st==="some"?"<i></i>":""}</span></button>`; }).join("")+
      (t&&!rows.length?`<div class="fp-empty">没有匹配「${esc(q.trim())}」的文件夹</div>`:"");
  };
  draw();
  requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add("show")));
  const close=()=>{ wrap.style.pointerEvents="none"; wrap.classList.remove("show"); setTimeout(()=>wrap.remove(),200); };
  const dot=()=>wrap.querySelector(".fp-sbtn .sdot").classList.toggle("show",!!q.trim());
  inp.oninput=()=>{ q=inp.value; clr.classList.toggle("show",!!q); dot(); draw(); };
  let downOnBack=false;
  wrap.onpointerdown=e=>{ downOnBack=e.target===wrap; };
  wrap.onclick=(e)=>{
    if(e.target===wrap){ if(downOnBack) close(); downOnBack=false; return; }   /* 点遮罩 = 取消（§45，第四轮推翻第二轮的判断） */
    const r=e.target.closest("[data-f]");
    if(r){ const id=r.dataset.f, st=cur[id];
      cur[id]= st==="all" ? "none" : st==="none" ? (init[id]==="some"?"some":"all") : "all";   /* 半选 → 全选 → 不选 → 半选（仅初始为半选时） */
      draw(); return; }
    const b=e.target.closest("[data-x]"); if(!b) return;
    const x=b.dataset.x;
    if(x==="s"){ searchOpen=!searchOpen; wrap.querySelector(".fpk").classList.toggle("searching",searchOpen); b.classList.toggle("on",searchOpen); b.setAttribute("aria-expanded",String(searchOpen));
      if(searchOpen) setTimeout(()=>inp.focus(),60); else inp.blur();   /* 收起保留关键词与筛选结果（§41） */
      return; }
    if(x==="clr"){ inp.value=""; q=""; clr.classList.remove("show"); dot(); draw(); inp.focus(); return; }
    if(x==="new"){ dialog({title:"新建文件夹", input:{value:"", placeholder:"文件夹名称"}, ok:"创建", onOk:async (v)=>{
        if(!v.trim()) return "名称不能为空";
        try{
          const rec=await vault.createFolder(v.trim());
          const f={id:rec.id,n:rec.n,c:0,s:[],ref:rec};
          FOLDERS.unshift(f); init[f.id]="none"; cur[f.id]="all"; draw(); list.scrollTop=0;
        }catch(err){ saveFail(err); return "创建失败"; }
      }}); return; }
    if(x==="c"){ close(); return; }
    if(x==="o"){
      const addIds=[], removeIds=[];
      FOLDERS.forEach(f=>{
        const a=init[f.id], b2=cur[f.id]; if(a===b2) return;
        if(b2==="all") addIds.push(f.id);
        else if(b2==="none") removeIds.push(f.id);
      });
      close();
      if(!addIds.length&&!removeIds.length){ return; }
      /* 内存先动，库随后写（失败有 Toast）；封面由仓储按「最近加入」重算 */
      ids.forEach(id=>{ const it=ITEMS.find(x=>x.id===id); if(!it) return; addIds.forEach(fid=>it.folderIds.add(fid)); removeIds.forEach(fid=>it.folderIds.delete(fid)); });
      refreshFolderCards();
      vault.setFolders(ids,addIds,removeIds).then(()=>{
        refreshFolderCards();
        render();
      }).catch(saveFail);
      S.select=false; S.sel=new Set(); render();
      /* C-01：已将 M 项加入 N 个文件夹；仅移除时「已从 N 个文件夹移出」 */
      const A=addIds.length, R=removeIds.length;
      toast(A&&!R?`已将 ${n} 项加入 ${A} 个文件夹`:!A?`已从 ${R} 个文件夹移出`:`已将 ${n} 项加入 ${A} 个文件夹，并从 ${R} 个移出`);
    }
  };
  return wrap;
}
/* ===== 通用进度弹窗（§44）：上传 / 导入大视频、下载解密、导出等耗时操作必须复用 =====
   const pg=progressDialog({title:"正在导出…", total:M, onCancel});
   pg.set({index:n(1 起), name:"文件名", pct:0–100})；pg.done({title:"导出完成", text:"已导出 M 项"})；pg.fail(text)；pg.close() */
function progressDialog(opts){
  const layer=document.getElementById("layer");
  const wrap=document.createElement("div");
  wrap.className="dlg-back pg-back";
  const btns=opts.noCancel
    ?`<div class="dbtns one" hidden></div>`
    :`<div class="dbtns one"><button type="button" data-x="c">${esc(opts.cancel||"取消")}</button></div>`;
  wrap.innerHTML=`<div class="dlg pgd" role="dialog" aria-modal="true" aria-labelledby="pg-t">
    <div class="pg-ic" aria-hidden="true"><i class="spin"></i>${ic("tick")}</div>
    <h4 id="pg-t">${esc(opts.title||"正在处理…")}</h4>
    <p class="pg-file" aria-live="polite">&nbsp;</p>
    <div class="pg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
    <div class="pg-meta"><span class="pg-n"></span><span class="pg-pct">0%</span></div>
    ${btns}</div>`;
  layer.appendChild(wrap);
  requestAnimationFrame(()=>requestAnimationFrame(()=>wrap.classList.add("show")));
  const $=sel=>wrap.querySelector(sel);
  let closed=false;
  const api={
    set({index,name,pct}){
      if(closed) return;
      const p=Math.max(0,Math.min(100,pct||0));
      if(name!=null) $(".pg-file").textContent=name;
      if(index!=null&&opts.total) $(".pg-n").textContent=`第 ${index} / ${opts.total} 项`;
      $(".pg-pct").textContent=Math.floor(p)+"%";
      $(".pg-bar i").style.transform=`scaleX(${p/100})`;
      $(".pg-bar").setAttribute("aria-valuenow",String(Math.floor(p)));
    },
    done({title,text,hold}={}){
      if(closed) return;
      api.set({pct:100});
      wrap.querySelector(".pgd").classList.add("is-done");
      $("#pg-t").textContent=title||"已完成"; $(".pg-file").textContent=text||"";
      $(".pg-n").textContent=""; 
      setTimeout(api.close, hold||1100);
    },
    fail(text){ if(closed) return; wrap.querySelector(".pgd").classList.add("is-fail"); $("#pg-t").textContent="未完成"; $(".pg-file").textContent=text||""; setTimeout(api.close,1400); },
    close(){ if(closed) return; closed=true; wrap.classList.remove("show"); setTimeout(()=>wrap.remove(),240); }
  };
  wrap.onclick=e=>{
    if(opts.noCancel) return;
    const b=e.target.closest("[data-x]");
    if(b&&!closed){ opts.onCancel&&opts.onCancel(); api.close(); }
  };
  return api;
}

/**
 * 永久删除（含分块大文件）带进度反馈：超过 ~300ms 才弹出进度窗，避免闪一下。
 * 完成后才改列表 / 导航；不可取消（半删会留下孤儿，启动时再清）。
 */
async function purgeWithUi(ids, { toastText="已删除" }={}){
  const list=[...new Set(ids||[])];
  if(!list.length) return 0;
  const t0=Date.now();
  let pg=null;
  const showTimer=setTimeout(()=>{
    pg=progressDialog({title:"正在删除…", total:list.length, noCancel:true});
  }, 300);
  try{
    await vault.purgeItems(list, {
      onProgress:(p)=>{
        if(!pg && Date.now()-t0>=300){
          clearTimeout(showTimer);
          pg=progressDialog({title:"正在删除…", total:list.length, noCancel:true});
        }
        if(!pg) return;
        const it=ITEMS.find(x=>x.id===p.id);
        const name=it&&it.name || "文件";
        const extra=(p.chunkTotal&&p.chunkTotal>0)
          ?` · 块 ${p.chunkRemoved||0}/${p.chunkTotal}` : "";
        pg.set({index:p.index, name:name+extra, pct:p.pct});
      },
    });
  }finally{
    clearTimeout(showTimer);
  }
  list.forEach(id=>media.release("thumb",id));
  ITEMS=ITEMS.filter(x=>!list.includes(x.id));
  refreshFolderCards();
  if(pg){
    pg.done({title:"已删除", text:toastText, hold:700});
    await new Promise(r=>setTimeout(r,720));
  }else{
    toast(toastText);
  }
  return list.length;
}
/* ===== 真实导出（§44 进度弹窗）：逐项解密 → 下载 =====
   iOS 对连续多文件下载支持有限，必要时用户可分次导出；导出不改动本地数据。 */
async function exportSelected(ids){
  const list=ITEMS.filter(it=>ids.includes(it.id));
  if(!list.length) return;
  let cancelled=false, ok=0;
  const pg=progressDialog({title:"正在导出…", total:list.length, onCancel:()=>{ cancelled=true; toast("已取消导出"); }});
  for(let i=0;i<list.length;i++){
    if(cancelled) break;
    const it=list[i];
    pg.set({index:i+1,name:it.name,pct:(i/list.length)*100});
    try{
      /* 2.1.2：分块条目的 readBlob 会抛 CHUNKED（播放护栏不变），导出走专用的整份读取接口，
         得到的字节与源文件逐字节一致（含 EXIF），下载仍是原单个文件，不打包、不加进度条新状态。
         已知限制：大视频导出要整份缓冲，内存方案已延期，不在这里假装解决。 */
      const bytes = vault.readForExport ? await vault.readForExport(it.id) : await vault.readBlob(it.id);

      if(!bytes) throw new Error("读取失败");
      const blob=new Blob([bytes],{type:(it.ref&&it.ref.mime)||"application/octet-stream"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url; a.download=it.name||("文件"+(i+1));
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} },15000);
      ok++;
    }catch(err){ console.warn("导出失败",it.name,err); }
    pg.set({index:i+1,name:it.name,pct:((i+1)/list.length)*100});
  }
  if(cancelled) return;
  if(ok===list.length) pg.done({title:"导出完成", text:`已导出 ${ok} 项`});
  else pg.fail(`${list.length-ok} 项未能导出`);
}
/* ===== 真实导入：解密前的编码 / 缩略图生成 / 加密写入都在 Vault 里完成 ===== */
async function importFilesReal(files){
  const list=[...files];
  if(!list.length) return;
  importing=true;
  let cancelled=false;
  const pg=progressDialog({title:"正在导入…", total:list.length, onCancel:()=>{ cancelled=true; toast("已取消导入"); }});
  try{
    const { imported, failed }=await vault.importFiles(list,{
      cancelled:()=>cancelled,
      onProgress:({index,total,name,pct})=>pg.set({index,name,pct}),
    });
    hydrate(); render._sig=null; render();
    if(cancelled) return;
    if(failed.length){
      /* §44：失败不静默 —— 明确「成功 N / 失败 M」，并列出前几个文件名（适量显示，完整明细进控制台） */
      const names=failed.slice(0,3).map(f=>f.name).join("、");
      const more=failed.length>3?` 等 ${failed.length} 项`:"";
      pg.fail(`成功 ${imported.length} / 失败 ${failed.length}：${names}${more}`);
      console.warn("导入失败明细", failed.map(f=>({name:f.name,code:f.code,message:String((f.error&&f.error.message)||f.error)})));
    }
    else pg.done({title:"导入完成", text:`已导入 ${imported.length} 项`});
  }catch(err){
    pg.fail(quotaError(err)?"本机存储空间不足，未能导入":(err&&err.message)||"导入失败");
    saveFail(err);
  }finally{ importing=false; }
}
function prompt2(title, value, suffix, onOk){
  return dialog({title, input:{value, suffix}, ok:"确定", onOk});
}

function findItem(id){ return ITEMS.find(x=>x.id===id)||(S.folder?folderItems().find(x=>x.id===id):null); }
const PLYR_I18N={restart:"重新播放",rewind:"后退 {seektime} 秒",play:"播放",pause:"暂停",fastForward:"快进 {seektime} 秒",seek:"跳转",seekLabel:"{currentTime} / {duration}",played:"已播放",buffered:"已缓冲",currentTime:"当前时间",duration:"时长",volume:"音量",mute:"静音",unmute:"取消静音",enterFullscreen:"全屏",exitFullscreen:"退出全屏",settings:"设置",menuBack:"返回上一级",speed:"播放速度",normal:"正常",quality:"画质",loop:"循环",start:"开始",end:"结束",all:"全部",reset:"重置",disabled:"关闭",enabled:"开启"};
/* ========== 详情页查看器：照片 / 视频统一横向翻页（R10-04 / 06 / 07 / 08 / 10） ==========
   外壳仍是 .viewer（#000，不随主题；z-index / #layer>.viewer 选择器不变），内部一条轨道 + 三槽位（上一张 / 当前 / 下一张）。
   正式应用中照片背景与视频 src 都来自解密后 Blob 的 object URL（URL.createObjectURL），关闭时 revoke。 */
const PAGER_GAP=18;   /* R10-07：槽位间隙 18px（取 16–20 中间值），间隙即外壳的黑色 */
const PAGER_T="transform .3s cubic-bezier(.2,.9,.3,1)";   /* 时长沿用 §46 的 .3s 量级，缓动取项目既有的 cubic-bezier(.2,.9,.3,1)（.dlg / ebCancel 回弹） */
const noMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
/* R10-04：顺序 = 点开时所在列表（首页 / 搜索结果 / 文件夹详情），与 selectableIds 同口径过滤，去掉文档类 */
function viewerItems(id){
  const src=curCtx()==="folder"?folderItems().filter(it=>matchQ(it.name)&&matchF(it)):filteredItems();
  const ids=src.filter(it=>!it.doc).map(it=>it.id);
  return ids.includes(id)?ids:[id];   /* 兜底：当前项被筛选排除时只显示这一张（不循环、不越界） */
}
/* R10-05：幻灯片播放列表 = 文件夹详情当前列表同口径（关键词 / 筛选项，与 viewerItems 一致），去掉文档；从第一项开始 */
function slideshowIds(){ return folderItems().filter(it=>matchQ(it.name)&&matchF(it)).filter(it=>!it.doc).map(it=>it.id); }
/* 槽位里的 muted 只给「封面用」的相邻槽位（相邻项不挂 Plyr）；当前槽位由 renderSlots() 在挂 Plyr 前摘掉，见下 */
function slotHTML(it){
  if(!it) return `<div class="vslot"></div>`;
  if(it.video) return `<div class="vslot" data-slot="${it.id}"><div class="vstage"><video playsinline webkit-playsinline muted preload="metadata" data-vid="${it.id}"></video>
      <div class="vseek l">−10 秒</div><div class="vseek r">+10 秒</div></div></div>`;
  /* 照片背景来自解密后的 Blob objectURL（原图优先，未就绪先用缩略图占位） */
  const u=media.url("orig",it.id)||media.url("thumb",it.id);
  return `<div class="vslot" data-slot="${it.id}"><div class="img" data-full="${it.id}" style="background-image:${u?`url("${u}")`:"none"}"></div></div>`;
}
/** 槽位渲染后异步补上原图 / 视频源（#t=0.1 用于 iOS 出第一帧，§68） */
function hydrateSlots(v){
  v.querySelectorAll("[data-full]").forEach(el=>{
    const id=el.dataset.full;
    media.ensure("orig",id).then(u=>{ if(u&&el.isConnected) el.style.backgroundImage=`url("${u}")`; });
  });
  v.querySelectorAll("video[data-vid]").forEach(el=>{
    const id=el.dataset.vid;
    const apply=(u)=>{
      if(!(u&&el.isConnected)) return;
      el.src=u+"#t=0.1";
      vFirstFrame(el);
      /* SW 被系统杀后旧 token 会 403：失败时重新授权并换新 URL，保留当前进度 */
      if(el.dataset.streamRetryBound) return;
      el.dataset.streamRetryBound="1";
      el.addEventListener("error",()=>{
        if(el.dataset.streamRetried) return;
        el.dataset.streamRetried="1";
        const t=el.currentTime||0;
        media.release("video",id);
        Stream.restore().catch(()=>{}).then(()=>media.ensure("video",id)).then(u2=>{
          if(!(u2&&el.isConnected)) return;
          el.src=u2;
          const resume=()=>{ try{ if(t>0.2) el.currentTime=t; }catch(_){} };
          if(el.readyState>=1) resume(); else el.addEventListener("loadedmetadata",resume,{once:true});
          vFirstFrame(el);
        });
      },{once:true});
    };
    media.ensure("video",id).then(u=>{
      apply(u);
      /* 2.1.2：用户打开了这条视频（media 里已有解密 URL）→ 继续补剩下没封面的视频，
         大 legacy 文件正是靠这条路在不额外解密的前提下拿到封面 */
      if(u){ const it=findItem(id); if(it&&it.video&&!it.hasThumb) lazyBackfillCovers(); }
    });
  });
}
/* R10-08：未播放时显示视频第一帧——src 带媒体片段 #t=0.1（iOS Safari 只 preload=metadata 时常不解码画面，
   片段会让它直接渲染该帧）；metadata 到了再 seek 到约 0.1s 兜底（第 0 帧常是纯黑），滑到视频时不黑屏 */
function vFirstFrame(video){
  const seek=()=>{ if(video.dataset.ff) return; video.dataset.ff="1"; try{ video.currentTime=0.1; }catch(_){} };
  if(video.readyState>=1) seek(); else video.addEventListener("loadedmetadata",seek,{once:true});
}
/* 视频槽位挂 Plyr：控件集 / 速度菜单 / i18n / chrome-hidden / 双击 ±10 秒全部沿用原 openVideo，只是把作用域收到当前槽位 */
function mountPlyr(host, video, stage, onAdjacent){
  const player=new Plyr(video,{
    controls:["play-large","rewind","play","fast-forward","progress","current-time","duration","mute","volume","settings","fullscreen"],
    settings:["speed"], speed:{selected:1,options:[0.5,0.75,1,1.25,1.5,2]}, seekTime:10,
    invertTime:false, toggleInvert:false, displayDuration:true, hideControls:true, resetOnEnd:false,
    fullscreen:{enabled:true,fallback:true,iosNative:true},
    tooltips:{controls:false,seek:true}, keyboard:{focused:true,global:false},
    iconUrl:"vendor/plyr/plyr.svg", blankVideo:"vendor/plyr/blank.mp4", i18n:PLYR_I18N
  });
  /* 2.1.2（用户 pt225 第 4 项 + pt226 已同意）：这两个位置的按钮改成「上一项 / 下一项」相邻媒体。
     外观零改动：仍是定稿里的双箭头图标与位置，只是把 Plyr 默认的 ±seekTime 换成翻页；
     双击 ±10 秒保留在下方 pointerup 里。到第一/最后一项时按钮不隐藏，点了没反应（与横滑到头一致）。 */
  if(typeof onAdjacent==="function"){
    host.querySelectorAll(".plyr__control[data-plyr='rewind'], .plyr__control[data-plyr='fast-forward']").forEach(btn=>{
      const dir=btn.dataset.plyr==="rewind"?-1:1;
      btn.setAttribute("aria-label", dir<0?"上一项":"下一项");
      btn.setAttribute("title", dir<0?"上一项":"下一项");
      /* 捕获阶段拦掉 Plyr 自己的 seek 处理，再走查看器的同一条过渡 */
      btn.addEventListener("click", ev=>{ ev.preventDefault(); ev.stopPropagation(); onAdjacent(dir); }, true);
    });
  }
  player.on("controlshidden",()=>host.classList.add("chrome-hidden"));
  player.on("controlsshown",()=>host.classList.remove("chrome-hidden"));
  /* 2.2.0：播放中自动锁定不计时；暂停/结束重新起算 */
  video.addEventListener("pause",()=>bumpAutoLock());
  video.addEventListener("ended",()=>bumpAutoLock());
  /* 双击 / 双指点左右三分之一：−10 / +10 秒（中间保留 Plyr 的双击全屏） */
  let last=0, lastSide="";
  const sideOf=x=>{ const r=stage.getBoundingClientRect(), f=(x-r.left)/r.width; return f<1/3?"l":f>2/3?"r":""; };
  const bubble=side=>{ const b=stage.querySelector(".vseek."+side); if(!b) return; b.classList.add("show"); clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove("show"),500); };
  stage.addEventListener("pointerup",e=>{
    if(e.target.closest(".plyr__controls,.plyr__menu__container,.plyr__control--overlaid")) return;
    const side=sideOf(e.clientX), now=Date.now();
    if(side&&side===lastSide&&now-last<300){
      const d=side==="l"?-10:10;
      video.currentTime=Math.max(0,Math.min((video.duration||0),video.currentTime+d));
      bubble(side); last=0; lastSide=""; return;
    }
    last=now; lastSide=side;
  },true);
  stage.addEventListener("dblclick",e=>{ if(sideOf(e.clientX)) e.stopPropagation(); },true);
  return player;
}
function openViewer(id, opts){
  const it0=findItem(id);
  if(!it0||it0.doc){ toast(it0?("文档："+it0.name):"无法打开"); return; }
  const items=viewerItems(id);
  let idx=Math.max(0,items.indexOf(id));
  /* R11-05：打开时快照「从哪个页面进来的」（首页 / 搜索结果 / 文件夹详情 / 回收站），关闭时据此回到该页，
     不依赖关闭时的 S 推断（查看器打开期间 S.tab / S.folder 理论上不会变，这里只是把它钉死） */
  const from={tab:S.tab,folder:S.folder};
  /* R10-05/09：幻灯片就是本查看器的「幻灯片模式」——翻页仍走 v._pager.go(1)，过渡与间隙与 R10-06/07 完全相同；
     只换播放规则与顶栏：左侧「退出」+ 右侧「暂停 / 继续」，默认隐藏 */
  const SS=!!(opts&&opts.slideshow), SI=Math.max(1,+S.slideInt||3);   /* SI = 幻灯片间隔（秒） */
  const layer=document.getElementById("layer");
  const v=document.createElement("div");
  v.className="viewer vpager";
  v.innerHTML=`<div class="vrail"><div class="vtrack"></div></div>
    <div class="vbar">${SS?`<button type="button" class="vbtn" data-x="back">${ic("x")}退出</button>`
    :`<button type="button" class="vbtn" data-x="back">${ic("chevl")}返回</button>`}
    <b></b>
    ${SS?`<button type="button" class="vbtn" data-x="pause" aria-label="暂停">${ic("pause")}</button>`
    :`<button type="button" class="vbtn" data-x="ren">${ic("pen")}重命名</button>`}</div>`;
  layer.appendChild(v);
  const rail=v.querySelector(".vrail"), track=v.querySelector(".vtrack"), bar=v.querySelector(".vbar");
  const cur=()=>findItem(items[idx]);
  const curImg=()=>{ const s=track.children[1]; return s?s.querySelector(".img"):null; };
  const W=()=>rail.clientWidth||v.clientWidth||innerWidth;
  const Z={s:1,tx:0,ty:0};   /* R10-10 当前照片的缩放 / 平移；s=1 即原始适配大小 */
  let player=null, mode=null, moved=false, dx=0, x0=0, y0=0, t0=0, panX=0, panY=0, pinch=null;
  let lastTap=0, lastX=0, lastY=0, tapSwallow=false;   /* 横拖起手于大播放按钮时，吞掉松手后那一次 click */
  let ssTimer=0, ssPaused=false;   /* R10-05：幻灯片照片停留计时 / 暂停状态（播到最后一项也进暂停） */
  const P=new Map();   /* 活动指针 id → {x,y}：一指翻页 / 放大后平移，两指捏合 */
  /* R11-05：下滑退出（对齐 iOS 相册）。跟手作用在当前 .vslot 的 transform 上 —— 与 .vtrack（翻页）、.img（缩放）
     都不是同一个元素，三者互不抢；只动 transform / opacity，不改 left/top/width/height。外壳的黑色背景同步变淡，
     露出下面那一页相册（查看器本来就是叠在相册页之上的覆盖层），顶栏淡出。 */
  const D={on:false,dy:0,t:0};
  const DH=()=>rail.clientHeight||innerHeight;
  const curSlot=()=>track.children[1];
  const dBarBase=()=>v.classList.contains("vbar-hidden")||v.classList.contains("chrome-hidden")?0:1;   /* 本来隐藏的控制条不因下滑而冒出来 */
  function dismissSet(dy){
    const slot=curSlot(); if(!slot) return;
    if(!D.on){ ssClear(); const vd=ssVideo(); if(vd) vd.onended=null; }   /* R11-05：进入跟手先停幻灯片停留计时（连同视频播完的推进），手指按住时不会在手下翻页 */
    const p=Math.min(dy/DH(),1);
    D.on=true; D.dy=dy;
    slot.style.transition="none";
    slot.style.transform="translate3d(0,"+dy+"px,0) scale("+(1-p*0.35)+")";
    v.style.transition="none";
    v.style.backgroundColor="rgba(0,0,0,"+(1-p*0.6)+")";
    bar.style.transition="none"; bar.style.opacity=String(dBarBase()*(1-Math.min(p/0.3,1)));
  }
  /* 未过阈值 / pointercancel：带过渡回弹原位，顶栏与背景复原 */
  function dismissClear(anim){
    const slot=curSlot();
    D.on=false; D.dy=0;
    if(slot){ slot.style.transition=anim&&!noMotion()?"transform .28s cubic-bezier(.2,.9,.3,1)":"none"; slot.style.transform=""; slot.style.opacity=""; }
    v.style.transition=anim&&!noMotion()?"background-color .28s ease":"none";
    v.style.backgroundColor="rgba(0,0,0,1)";
    bar.style.transition=anim?"opacity .3s ease":"none"; bar.style.opacity="";
    if(SS) ssArm();   /* R11-05：回弹后按当前项重新计时（与 R10-05「手动翻页后重新计时」同一口径） */
    clearTimeout(D.t);
    D.t=setTimeout(()=>{   /* 过渡结束后清掉内联值，回到 CSS（.viewer 的 #000 / .vbar-hidden 等类名规则） */
      if(D.on) return;
      v.style.removeProperty("transition"); v.style.removeProperty("background-color");
      bar.style.removeProperty("transition"); bar.style.removeProperty("opacity");
    },noMotion()?0:300);
  }
  /* 过阈值：继续缩小淡出，然后走与「返回」完全相同的 close() */
  function dismissOut(){
    const slot=curSlot(), H=DH();
    D.on=false;
    if(slot){
      slot.style.transition=noMotion()?"none":"transform .2s ease-out, opacity .2s ease-out";
      slot.style.transform="translate3d(0,"+(D.dy+H*0.12)+"px,0) scale(.78)";
      slot.style.opacity="0";
    }
    v.style.transition=noMotion()?"none":"background-color .2s ease-out";
    v.style.backgroundColor="rgba(0,0,0,0)";
    D.dy=0;
    clearTimeout(D.t);
    D.t=setTimeout(close,noMotion()?0:180);
  }

  /* 轨道定位：x=0 表示当前槽位正对屏幕；槽位步长 = 屏宽 + 间隙 */
  function place(x,anim){
    track.style.transition=anim&&!noMotion()?PAGER_T:"none";
    track.style.transform="translate3d("+(-(W()+PAGER_GAP)+x)+"px,0,0)";
  }
  /* 照片按 contain 铺在槽位里的实际画面尺寸（用背景图自然宽高比；取不到按方形兜底） */
  function imgBox(im){
    const w=W(), h=rail.clientHeight||innerHeight, ar=im._ar||1;
    return w/h>ar?{w:h*ar,h}:{w,h:w/ar};
  }
  function loadAspect(im){
    if(im._ar||im._arPending) return;
    im._arPending=true;
    const m=/url\((["']?)(.*?)\1\)/.exec(getComputedStyle(im).backgroundImage);
    if(!m) return;
    const probe=new Image();
    probe.onload=()=>{ if(probe.naturalWidth&&probe.naturalHeight) im._ar=probe.naturalWidth/probe.naturalHeight; };
    probe.src=m[2];
  }
  function paintZoom(){ const im=curImg(); if(im) im.style.transform="translate3d("+Z.tx+"px,"+Z.ty+"px,0) scale("+Z.s+")"; }
  /* R10-10：缩放到 s（以屏幕坐标 fx / fy 为不动点）；最大 4 倍，不小于适配大小（捏合过程中 soft 允许阻尼回弹）；
     放大后平移限制在图片边界内；只要不是适配大小 → 顶栏自动淡出 */
  function zoomTo(s,fx,fy,anim,soft){
    if(SS) return;   /* R10-05：幻灯片模式下照片不支持缩放（双击 / 捏合都不生效），以免和停留计时冲突 */
    const im=curImg(); if(!im) return;
    if(s>1) loadAspect(im);
    const r=rail.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    s=Math.min(4,Math.max(soft?0.6:1,s));
    const k=s/Z.s, px=(fx==null?cx:fx)-cx, py=(fy==null?cy:fy)-cy;
    const box=imgBox(im);
    const mx=Math.max(0,(box.w*s-r.width)/2), my=Math.max(0,(box.h*s-r.height)/2);
    Z.s=s;
    Z.tx=Math.min(mx,Math.max(-mx,px*(1-k)+k*Z.tx));
    Z.ty=Math.min(my,Math.max(-my,py*(1-k)+k*Z.ty));
    im.style.transition=anim&&!noMotion()?"transform .22s cubic-bezier(.2,.9,.3,1)":"none";
    paintZoom();
    v.classList.toggle("vbar-hidden",Z.s>1.001);
  }
  function resetZoom(){
    const im=curImg();
    if(im){ Z.s=1; Z.tx=0; Z.ty=0; im.style.transition="none"; im.style.transform=""; }
    if(!SS) v.classList.remove("vbar-hidden");   /* R10-05：幻灯片模式的控制条只由点屏幕控制，翻页不自动弹出 */
  }
  /* R10-10：双击放大到约 2.5 倍（以点击点为中心）；放大状态下双击回到适配大小并恢复顶栏 */
  function doubleTap(x,y){ if(Z.s>1.001) zoomTo(1,null,null,true); else zoomTo(2.5,x,y,true); }
  function syncBar(){ const it=cur(); bar.querySelector("b").textContent=it?it.name:""; }
  /* 重排三槽位：先销毁 Plyr、重建槽位（预渲染新的相邻项，切换后不闪），再只给「当前」槽位挂 Plyr */
  function renderSlots(){
    track.querySelectorAll("video").forEach(x=>{ try{ x.pause(); }catch(_){} });
    if(player){ try{ player.destroy(); }catch(_){} player=null; v._player=null; }
    track.innerHTML=slotHTML(findItem(items[idx-1]||""))+slotHTML(cur())+slotHTML(findItem(items[idx+1]||""));
    track.querySelectorAll("video").forEach(vFirstFrame);   /* 相邻槽位也出第一帧，滑到视频时不黑屏 */
    place(0,false);
    v.classList.toggle("vplayer",!!(cur()&&cur().video));
    v.classList.remove("chrome-hidden");
    const slot=track.children[1], video=slot?slot.querySelector("video"):null;
    /* R10-08 修正：两侧槽位的 muted 只服务于封面预载（相邻项不挂 Plyr）；「当前」槽位是用户真正播放的那一支，
       必须在这里先取消静音——Plyr 构造时会把 media 的 muted 属性读成 config.muted=true，控件随即显示静音图标、
       点播放没声音。去属性 + muted=false 后与改前 openVideo 一致：默认有声音、音量图标为非静音。翻页时同一路径生效。 */
    if(video){ video.muted=false; video.removeAttribute("muted"); }
    /* R10-05：幻灯片模式的视频只做自动播放——不挂 Plyr（Plyr 控件层会抢走「点屏幕切换控制条」的单击），也不出原生控件 */
    if(SS){ if(video) video.removeAttribute("controls"); }
    else if(video&&window.Plyr){ player=mountPlyr(v,video,slot.querySelector(".vstage"), d=>{ pager.go(d); }); v._player=player; }
    else if(video) video.controls=true;   /* 无 Plyr 时退回原生控件 */
    syncBar();
    hydrateSlots(v);
  }
  function onChangePage(){
    resetZoom();
    renderSlots();
    if(SS) ssArm();   /* R10-05：翻页（含手动滑）后按当前项重新计时 / 自动播放 */
    if(typeof pager.onChange==="function") pager.onChange(idx,cur());
  }
  /* R10-05/09：幻灯片推进——照片停「幻灯片间隔」秒后 go(1)；视频自动播放，播完（ended）再 go(1)，不受间隔限制；
     到最后一项不再前进：停在最后一项、进入暂停并显示控制条（不循环，用户可退出）。 */
  function ssBar(show){ v.classList.toggle("vbar-hidden",!show); }
  function ssIcon(){ const b=bar.querySelector('[data-x="pause"]'); if(!b) return; b.innerHTML=ic(ssPaused?"play":"pause"); b.setAttribute("aria-label",ssPaused?"继续":"暂停"); }
  function ssClear(){ if(ssTimer){ clearTimeout(ssTimer); ssTimer=0; } }
  function ssVideo(){ const s=track.children[1]; return s?s.querySelector("video"):null; }
  function ssStop(){ ssClear(); const vd=ssVideo(); if(vd){ try{ vd.onended=null; vd.pause(); }catch(_){} } }
  function ssNext(){
    if(idx>=items.length-1){ ssPaused=true; ssBar(true); ssIcon(); return; }   /* 最后一项播完：停下并露出控制条 */
    slideBy(1).then(done=>{ if(!done) ssArm(); });   /* 动画被打断（正在手动翻页 / 已是最后一项）时补一次，避免卡住 */
  }
  function ssArm(){
    ssClear();
    if(ssPaused) return;
    const it=cur(); if(!it) return;
    if(it.video){
      const vd=ssVideo(); if(!vd) return;
      vd.loop=false;
      vd.onended=()=>{ vd.onended=null; ssNext(); };
      const pr=vd.play();
      /* 浏览器拒绝有声自动播放：退为静音再播（幻灯片不做手势解锁音频） */
      if(pr&&pr.catch) pr.catch(()=>{ vd.muted=true; const p2=vd.play(); if(p2&&p2.catch) p2.catch(()=>{}); });
    } else ssTimer=setTimeout(()=>{ ssTimer=0; ssNext(); },SI*1000);
  }
  /* 切换一屏；手势与程序调用（2b 幻灯片用 v._pager.go(±1)）走同一条过渡与同一个间隙 */
  /* 切换过渡（300ms）期间又按下开始拖动：先把上一次切换「结算」掉——清定时器、同步 idx 变化 + renderSlots 归位，
     再以新起点开始本次拖动；否则 place() 跳位与 done() 重置轨道会跟手指错位（iOS 上连续快速翻页很常见）。
     动画期间再调 go() 直接返回 false（不排队），避免 done() 二次推进。 */
  let slideTimer=0, slideDir=0, slideResolve=null;
  function settleSlide(){
    if(!slideTimer) return false;
    clearTimeout(slideTimer); slideTimer=0;
    const d=slideDir, res=slideResolve; slideDir=0; slideResolve=null;
    idx+=d>0?1:-1;
    onChangePage();
    if(res) res(true);
    return true;
  }
  function slideBy(dir){
    if(!dir||(dir>0?idx>=items.length-1:idx<=0)) return Promise.resolve(false);
    if(slideTimer) return Promise.resolve(false);   /* 动画中：忽略，不排队 */
    const step=W()+PAGER_GAP;
    track.style.transition=!noMotion()?PAGER_T:"none";
    track.style.transform="translate3d("+(-step-dir*step)+"px,0,0)";
    const done=()=>{ idx+=dir>0?1:-1; onChangePage(); return true; };
    if(noMotion()) return Promise.resolve(done());
    slideDir=dir;
    return new Promise(res=>{
      slideResolve=res;
      slideTimer=setTimeout(()=>{ slideTimer=0; slideDir=0; slideResolve=null; res(done()); },300);
    });
  }
  const pager={go:slideBy,get index(){return idx},items:items.slice(),onChange:null};   /* 给 2b 幻灯片预留 */
  v._pager=pager;
  /* 手势：一指横拖翻页 / 放大后一指平移，两指捏合缩放，双击放大或还原（R10-04 / 06 / 10）。
     视频页从 Plyr 控件区域起手不翻页；双击 ±10 秒仍由 mountPlyr 处理，两者互不干扰。 */
  rail.addEventListener("pointerdown",e=>{
    if(e.button>0) return;
    /* 大播放按钮（.plyr__control--overlaid）正好压在视频中间、也是"视频中间区域横滑"的落点，不能把翻页起手挡掉：
       点按（未位移）仍交给按钮播放，横拖由 tapSwallow 在 pointerup 后吞掉这次 click（见下）。 */
    if(e.target.closest(".plyr__controls,.plyr__menu__container,.vseek")) return;
    settleSlide();   /* 上一次切换动画未结算：先落定 idx 并重排槽位，再从新槽位起拖 */
    tapSwallow=false;
    P.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(P.size===2){ startPinch(); return; }
    if(P.size>2) return;
    mode=null; moved=false; dx=0; x0=e.clientX; y0=e.clientY; t0=performance.now();
  },{passive:true});
  function startPinch(){
    if(SS) return;   /* R10-05：幻灯片模式不支持捏合缩放 */
    const im=curImg();
    if(!im||(cur()&&cur().video)) return;   /* 只有照片支持缩放 */
    if(mode==="page") place(0,true);
    if(mode==="dismiss") dismissClear(false);   /* R11-05：下滑中途落下第二指 → 归位后按双指缩放处理 */
    mode="pinch"; moved=true; loadAspect(im);
    const [a,b]=[...P.values()];
    pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,s:Z.s};
  }
  function movePinch(){
    if(!pinch) return;
    const [a,b]=[...P.values()];
    const d=Math.hypot(a.x-b.x,a.y-b.y)||1;
    let s=pinch.s*d/pinch.d;
    if(s<1) s=1+(s-1)*0.45;   /* 低于适配大小：阻尼，松手回弹 */
    zoomTo(s,(a.x+b.x)/2,(a.y+b.y)/2,false,true);
  }
  rail.addEventListener("pointermove",e=>{
    if(!P.has(e.pointerId)) return;
    P.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(P.size>=2){ if(mode==="pinch") movePinch(); return; }
    const ax=e.clientX-x0, ay=e.clientY-y0;
    if(!mode){
      if(Math.hypot(ax,ay)<8) return;
      moved=true;
      if(Z.s>1.001){ mode="pan"; panX=Z.tx; panY=Z.ty; }   /* 放大状态：单指拖动平移，不触发翻页 */
      else if(Math.abs(ay)>Math.abs(ax)*1.15) mode=ay>0?"dismiss":"vertical";   /* 竖向为主的拖动不翻页；向下（R11-05）→ 下滑退出，向上仍什么都不做 */
      else mode="page";
    }
    if(mode==="vertical") return;
    if(e.cancelable) e.preventDefault();
    if(mode==="dismiss"){ dismissSet(Math.max(0,ay)); return; }   /* R11-05：跟手下移 + 缩小（上滑 dy 夹到 0，不动） */
    if(mode==="pan"){
      const im=curImg(); if(!im) return;
      const r=rail.getBoundingClientRect(), box=imgBox(im);
      const mx=Math.max(0,(box.w*Z.s-r.width)/2), my=Math.max(0,(box.h*Z.s-r.height)/2);
      Z.tx=Math.min(mx,Math.max(-mx,panX+ax));
      Z.ty=Math.min(my,Math.max(-my,panY+ay));
      im.style.transition="none"; paintZoom();
      return;
    }
    /* 跟手：两张连续可见、边界线跟手；首尾各按 1/3 阻尼（不循环） */
    let x=ax;
    if((idx===0&&x>0)||(idx===items.length-1&&x<0)) x=x/3;
    dx=x; place(x,false);
  },{passive:false});
  function endPointer(e,cancelled){
    if(!P.has(e.pointerId)) return;
    P.delete(e.pointerId);
    if(mode==="pinch"){
      if(P.size>=2) return;
      pinch=null;
      if(Z.s<1) zoomTo(1,null,null,true);   /* 缩小过头：松手弹回适配大小 */
      if(P.size===1){ const p=[...P.values()][0]; x0=p.x; y0=p.y; panX=Z.tx; panY=Z.ty; mode=Z.s>1.001?"pan":"none"; return; }
      mode=null; return;
    }
    if(P.size) return;
    /* pointercancel（系统手势 / 触摸被接管）：只回弹归位，绝不触发切换，也不参与双击判定 */
    if(cancelled){
      if(mode==="page"&&moved) place(0,true);
      if(mode==="dismiss") dismissClear(true);   /* R11-05：取消一律回弹，不退出 */
      mode=null; moved=false; dx=0; return;
    }
    /* R11-05：下滑退出判定——下移 > 屏高 15%，或下移 > 28px 且速度 ≥ EB_VEL（与翻页同一阈值口径）→ 退出；否则回弹 */
    if(mode==="dismiss"){
      const dtY=Math.max(1,performance.now()-t0), vely=D.dy/dtY, h=DH();
      tapSwallow=true;   /* 拖过：吞掉松手后落在大播放按钮上的那次 click */
      if(D.dy>h*0.15||(D.dy>28&&vely>=EB_VEL)) dismissOut(); else dismissClear(true);
      mode=null; moved=false; dx=0; return;
    }
    const dt=Math.max(1,performance.now()-t0), vel=dx/dt, w=W(), dir=dx<0?1:-1;
    const canSwitch=dir>0?idx<items.length-1:idx>0;
    /* R10-06：位移过半，或快速甩动（速度阈值沿用 EB_VEL=0.45 px/ms 且方向与位移一致）→ 切换，否则回弹 */
    if(mode==="page"&&moved&&canSwitch&&(Math.abs(dx)>w/2||(Math.abs(dx)>28&&Math.abs(vel)>=EB_VEL&&Math.sign(vel)===Math.sign(dx)))) slideBy(dir);
    else if(mode==="page"&&moved) place(0,true);
    /* R10-05：幻灯片模式单击屏幕（未拖动）= 显示 / 隐藏控制条；本模式不缩放、不判双击 */
    if(SS&&!moved){ ssBar(v.classList.contains("vbar-hidden")); mode=null; moved=false; dx=0; return; }
    /* 单击 / 双击：判定窗口 300ms（与视频 ±10 秒一致）；不动才算点击，横拖后不误触发 */
    if(!moved&&!(cur()&&cur().video)){
      const now=performance.now();
      if(lastTap&&now-lastTap<300&&Math.hypot(e.clientX-lastX,e.clientY-lastY)<80){ doubleTap(e.clientX,e.clientY); lastTap=0; }
      else { lastTap=now; lastX=e.clientX; lastY=e.clientY; }
    }
    if(moved) tapSwallow=true;   /* 横拖过：后续 click 若是大播放按钮就吞掉（点按不受影响） */
    mode=null; moved=false; dx=0;
  }
  rail.addEventListener("pointerup",e=>endPointer(e,false),{passive:true});
  rail.addEventListener("pointercancel",e=>endPointer(e,true),{passive:true});
  /* 横拖收尾后浏览器仍可能给起手元素（大播放按钮）派发 click —— 这里吃掉，避免翻页同时开始播放 */
  rail.addEventListener("click",e=>{
    if(tapSwallow&&e.target.closest(".plyr__control--overlaid")){ e.preventDefault(); e.stopPropagation(); }
    tapSwallow=false;
  },true);
  function close(){
    if(slideTimer){ clearTimeout(slideTimer); slideTimer=0; slideDir=0; slideResolve=null; }   /* 关窗后不再有悬空的切换结算 */
    clearTimeout(D.t); D.on=false; D.dy=0;   /* R11-05：下滑退出的收尾定时器一并清掉 */
    ssStop();   /* R10-05：退出时清掉停留计时器并暂停视频，不留后台推进 */
    track.querySelectorAll("video").forEach(x=>{ try{ x.pause(); x.removeAttribute("src"); }catch(_){} });
    try{ player&&player.destroy(); }catch(_){}
    media.releaseKind("orig");    /* 原图 / 视频的 objectURL 退出即释放（缩略图保留） */
    media.releaseKind("video");
    v.remove();
    /* R11-05：回到进入查看器前的那一页（首页 / 搜索结果 / 文件夹详情 / 回收站）——按打开时的快照，不靠关闭时的 S 推断 */
    if(S.tab!==from.tab||S.folder!==from.folder){ S.tab=from.tab; S.folder=from.folder; render(); }
  }
  v.addEventListener("click",e=>{
    const b=e.target.closest("[data-x]");
    if(!b) return;
    if(b.dataset.x==="back"){ close(); return; }
    if(b.dataset.x==="pause"){   /* R10-05：暂停 / 继续——照片停表、视频暂停；继续时当前项重新计时 / 续播 */
      ssPaused=!ssPaused; ssIcon();
      if(ssPaused) ssStop(); else ssArm();
      bumpAutoLock();
      return;
    }
    if(b.dataset.x==="ren"){   /* 重命名作用于「当前」项，文件名随翻页更新 */
      const it=cur(); if(!it) return;
      const {base,ext}=splitName(it.name), def=it.video?".mp4":".jpg";
      prompt2("重命名", base, ext||def, (val)=>{
        if(!val.trim()) return "名称不能为空";
        it.name=val.trim()+(ext||def);
        persistItem(it);          /* 改名写入存储：翻页回来仍是新名字 */
        syncBar(); toast("已重命名");
        return true;
      });
    }
  });
  renderSlots();
  if(SS){ ssBar(false); ssIcon(); ssArm(); }   /* R10-05：幻灯片默认不显示控制条，从第一项开始播 */
  window.__pager={   /* 验收调试（只读查询）：当前 index / items 的 id 列表 / 当前 scale / 轨道 transform */
    get index(){ return idx; },
    get ids(){ return items.slice(); },
    get scale(){ return Z.s; },
    get transform(){ return track.style.transform; },
    get gap(){ return PAGER_GAP; },
    get slots(){ return [...track.children].map(s=>s.dataset.slot||""); },
    get slideshow(){ return SS; },
    get paused(){ return ssPaused; },
    get interval(){ return SI; },
    /* R11-05：下滑退出状态（只读）——active=正在跟手，dy=当前下移距离，scale=当前槽位缩放（1 即未动） */
    get dismiss(){ return {active:D.on,dy:Math.round(D.dy*10)/10,scale:Math.round((1-Math.min(D.dy/DH(),1)*0.35)*1000)/1000}; },
    get from(){ return {tab:from.tab,folder:from.folder}; },
    go:slideBy,
    zoom:(s,fx,fy)=>zoomTo(s,fx,fy,true,true)
  };
}

/* ========== 计算器交互 ========== */
function wireCalc(){
  const mode=document.getElementById("calc-mode");
  mode.onclick=(e)=>{
    const b=e.target.closest("[data-mode]"); if(!b) return;
    S.calcMode=b.dataset.mode;
    [...mode.querySelectorAll("[data-mode]")].forEach(x=>x.classList.toggle("on",x===b));
    document.getElementById("mortgage-form").hidden = S.calcMode!=="mortgage";
    document.getElementById("tax-form").hidden = S.calcMode!=="tax";
    document.getElementById("calc-title").textContent = "贷税计算";   /* R11-01：顶栏恒为 App 名；「房贷计算 / 个税计算」只是分段控件的功能名 */
  };
  const rep=document.getElementById("repayment");
  rep.onclick=(e)=>{
    const b=e.target.closest("[data-rep]"); if(!b) return;
    S.repayment=b.dataset.rep;
    [...rep.querySelectorAll("[data-rep]")].forEach(x=>x.classList.toggle("on",x===b));
  };
  ["loan-amount","loan-years","loan-rate","tax-income","tax-insurance","tax-deduction","tax-bonus"].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener("input",()=>{ el.value=sanitizeDecimal(el.value); });
  });

  /* 「贷款金额」里输入 4–9 位纯数字时，先当作解锁码 / 紧急清除码判决；
     两个都不是才按普通贷款金额继续计算（不改变伪装层的表现）。 */
  document.getElementById("mortgage-form").onsubmit=(e)=>{
    e.preventDefault();
    const raw=document.getElementById("loan-amount").value.trim();
    if(PIN_RE.test(raw)){ handleSecretCode(raw); return; }
    runMortgageCalc();
  };
  runMortgageCalc=function(){
    const amountEl=document.getElementById("loan-amount");
    const yearsEl=document.getElementById("loan-years");
    const rateEl=document.getElementById("loan-rate");
    const err=document.getElementById("mortgage-error");
    const res=document.getElementById("mortgage-result");
    err.hidden=true; res.hidden=true;
    document.getElementById("fr-amount").classList.remove("err");

    const raw=amountEl.value.trim();
    const principal=parseAmount(raw);
    const years=parseAmount(yearsEl.value);
    const rate=parseAmount(rateEl.value);
    if(principal===null||principal<=0){
      err.textContent="请输入有效的贷款金额"; err.hidden=false;
      document.getElementById("fr-amount").classList.add("err"); return;
    }
    if(years===null||years<=0||years>50){ err.textContent="请输入 1–50 的贷款年限"; err.hidden=false; return; }
    if(rate===null||rate<0||rate>100){ err.textContent="请输入有效的年利率"; err.hidden=false; return; }
    try{
      const out=calculateMortgage({principalYuan:principal,years,annualRatePercent:rate,repayment:S.repayment});
      const isEP=S.repayment==="equal-payment";
      res.innerHTML=`<div class="rh"><small>${isEP?"等额本息":"等额本金"} · ${out.months} 期</small><b>计算结果</b></div>
        <div class="sum">贷款本金 ${fmt(principal)} 元</div>
        <div class="big"><span>${isEP?"每月月供":"首月月供"}</span><div>${fmt(out.firstPayment)}<i>元</i></div></div>
        ${isEP?"":`<div class="kv"><span>每月递减</span><b>${fmt(out.monthlyDecrease)}<i>元</i></b></div>`}
        <div class="kv"><span>支付利息</span><b>${fmt(out.totalInterest)}<i>元</i></b></div>
        <div class="kv"><span>还款总额</span><b>${fmt(out.totalPayment)}<i>元</i></b></div>
        <p class="note">以上为按月计息估算，未计入提前还款、利率浮动或银行手续费。</p>`;
      res.hidden=false;
    }catch(ex){ err.textContent=ex.message||"计算失败"; err.hidden=false; }
  };

  document.getElementById("tax-form").onsubmit=(e)=>{
    e.preventDefault();
    const income=parseAmount(document.getElementById("tax-income").value);
    const ins=parseAmount(document.getElementById("tax-insurance").value);
    const ded=parseAmount(document.getElementById("tax-deduction").value);
    const bonusText=document.getElementById("tax-bonus").value.trim();
    const bonus=bonusText===""?0:parseAmount(bonusText); /* R10-01：年终奖留空按 0 计算，仅非空且解析失败才提示 */
    const err=document.getElementById("tax-error");
    const res=document.getElementById("tax-result");
    err.hidden=true; res.hidden=true;
    if(income===null){ err.textContent="请输入有效的税前月收入"; err.hidden=false; return; }
    if(ins===null||ded===null){ err.textContent="请输入有效的扣除项"; err.hidden=false; return; }
    if(bonus===null){ err.textContent="请输入有效的年终奖收入"; err.hidden=false; return; }
    try{
      const out=calculateIncomeTax({monthlyIncome:income,socialInsurance:ins,specialDeduction:ded,yearEndBonus:bonus});
      res.innerHTML=`<div class="rh"><small>综合所得 · 月度估算</small><b>计算结果</b></div>
        <div class="big"><span>应缴个税</span><div>${fmt(out.payableTax)}<i>元</i></div></div>
        <div class="kv"><span>应纳税所得额</span><b>${fmt(out.taxableIncome)}<i>元</i></b></div>
        <div class="kv"><span>税后收入</span><b>${fmt(out.afterTaxIncome)}<i>元</i></b></div>
        ${bonus>0?`<div class="kv"><span>年终奖个税（单独计税）</span><b>${fmt(out.bonusTax)}<i>元</i></b></div>
        <div class="kv"><span>年终奖税后</span><b>${fmt(out.bonusAfterTax)}<i>元</i></b></div>`:""}
        <p class="note">月度工资按现行七级超额累进税率估算；年终奖按全年一次性奖金单独计税（÷12 查月度税率表）。未覆盖劳务等特殊情形。</p>`;
      res.hidden=false;
    }catch(ex){ err.textContent=ex.message||"计算失败"; err.hidden=false; }
  };
}


/* ========== 启动 ========== */
let vaultConfigured=false;
let importing=false;
let migrating=false;   /* 2.0.0 → 2.1.0 自动迁移进行中（与 importing 同一类「不要被打断」标记） */

/** 解锁成功后的统一收尾：清到期回收站、进相册、静默查新 */
async function afterUnlock(){
  try{
    /* 保留期以仓储里的设置为准：S.retention 是界面镜像，冷启动 / 刚迁移完时还没 hydrate，
       用它会拿到默认的 30 天，可能把用户设为「90 天 / 永不」的回收站条目提前删掉。 */
    const purged=await vault.purgeExpired(vault.settings.retention||"30");
    if(purged) console.info("已清理到期回收站项目", purged);
  }catch(err){ console.warn("回收站清理失败", err); }
  openAlbum();
  bumpAutoLock();
  /* 懒补：每种封面算法世代每条只试一次（见 coverFailGen）；升级 COVER_GEN 后会自动再试一轮 */
  lazyBackfillCovers();
  checkUpdate(false);
}
/* 2.1.2：已导入但没有封面的视频，懒补首帧 → 加密写入 thumbs。
   分块条目走 SW 流式 URL（不整份解密）；legacy 单 blob 只有小文件才顺序读一次，
   大文件只在用户自己打开播放、media 里已有解密 URL 时才复用。不重导入、不改动其它字段、失败静默跳过。
   **不设一次性闸门**：每次解锁、以及用户打开某个缺封面视频时都会继续处理剩下的条目
   （每次仍限 6 个，避免一次跑完耗电/占用主线程）。 */
let coverBackfillBusy=false;
let coverBadSweepDone=false;
async function lazyBackfillCovers(){
  if(coverBackfillBusy) return;
  coverBackfillBusy=true;
  let again=false;
  try{
    const Cover=await import("./core/cover.js");
    /* 升到新 COVER_GEN 时：先扫一遍「有记录但匀色/极小」的坏封面并作废，再懒补 */
    if(!coverBadSweepDone){
      coverBadSweepDone=true;
      try{
        const killed=await Cover.invalidateBadThumbs(vault);
        if(killed){
          media.clear();
          hydrate(); render._sig=null;
          if(!document.querySelector("#layer .viewer")) render();
        }
      }catch(e){ console.warn("坏封面扫描跳过", e); }
    }
    /* 一次只补 1 条：少读、不连播；coverFailGen>=COVER_GEN 的不再试 */
    const res=await Cover.backfillVideoCovers(vault,{limit:1, media});
    if(res&&res.fixed){
      hydrate(); render._sig=null;
      if(!document.querySelector("#layer .viewer")) render();
    }
    again=!!(res&&res.remaining>0&&!res.unavailable&&document.visibilityState!=="hidden");
  }catch(err){ console.warn("封面懒补跳过", err); }
  finally{ coverBackfillBusy=false; }
  if(again) setTimeout(()=>{ lazyBackfillCovers(); }, 600);
}
/** 紧急清除码：立即清空本机全部内容（含解锁码），回到首次使用状态 */
async function emergencyWipe(){
  try{
    await vault.wipeAll();
    media.clear();
    ITEMS=[]; FOLDERS=[]; TRASH=[];
    vaultConfigured=false; S.wipeOn=false;
    document.getElementById("v-album").hidden=true;
    lock();
    toast("已清除");
  }catch(err){ console.error(err); }
}
/** 「贷款金额」里的 4–9 位数字：清除码 → 解锁码 → 首次设置 → 普通金额 */
async function handleSecretCode(raw){
  if(!vaultConfigured){
    /* 2.0.0 自动迁移（chunk-08a）：同 origin 下旧库还在时，这个码先当**旧解锁码**试一次；
       成功就用同一个码建档 + 迁移并直接进相册。错码时静默回落到普通计算——
       **不能**弹「首次使用」，否则用户会误建一个空的新库，旧数据再也不会自动迁移。 */
    const detection=await warmLegacyDetection();
    if(detection.found){ await migrateLegacyFirstUse(raw); return; }
    askSetPin(raw); return;
  }
  if(S.wipeOn){
    try{ if(await vault.checkWipeCode(raw)){ emergencyWipe(); return; } }catch(_){}
  }
  let ok=false;
  try{ ok=await vault.unlock(raw); }catch(err){ console.error("解锁失败", err); }
  if(ok){
    notePinLength(raw);            /* 2.1.2：旧短码仍可解锁，只记一次「建议升级」的线索 */
    await resumeLegacyMigration(raw);
    await afterUnlock();     /* 等 openAlbum() 清完 #layer 再提示，否则 toast 会被新一轮渲染抹掉 */
    suggestLongerPin();
    return;
  }
  runMortgageCalc();   /* 不是解锁码：按普通贷款金额继续算 */
}

/** 迁移进度弹窗：复用 §44 通用进度弹窗（与导入/导出同款），不新增任何样式或屏 */
function legacyProgress(opts){
  return progressDialog({title:"正在迁移…", total:opts.total, cancel:"取消", onCancel:opts.onCancel});
}
/** 首次使用 + 旧库有数据：用同一个码建档并迁移（错码则照常算，不留痕） */
async function migrateLegacyFirstUse(pin){
  if(migrating){ return; }
  migrating=true;
  try{
    const res=await migrateLegacy({pin, vault, create:true, ui:{progress:legacyProgress}});
    if(res.status==="migrated"||res.status==="paused"||res.status==="failed"){
      if(res.created){ vaultConfigured=true; S.wipeOn=false; }
      if(res.created||res.status==="migrated"){
        migrating=false;
        await afterUnlock();
        const n=(res.counts&&res.counts.imported)||0;
        toast(res.status==="migrated"?(n?`已迁移 ${n} 项`:"迁移完成"):"迁移未完成，下次解锁会继续");
        return;
      }
    }
    if(res.status==="no-auth"){ askSetPin(pin); return; }
    if(res.status==="wrong-pin"||res.status==="no-legacy"){ runMortgageCalc(); return; }
    /* failed 且没建成新库：旧数据原样还在，伪装层照常 */
    runMortgageCalc();
  }finally{ migrating=false; }
}
/** 已建档：上次迁移被打断（App 被杀 / 切后台）时，用同一个解锁码接着做完剩下的部分 */
async function resumeLegacyMigration(pin){
  if(migrating) return;
  const state=await legacyMigrationState();
  if(!state||state.state!=="running") return;
  migrating=true;
  try{
    const res=await migrateLegacy({pin, vault, ui:{progress:legacyProgress}});
    if(res.status==="migrated"){
      const n=(res.counts&&res.counts.imported)||0;
      if(n) toast(`已迁移 ${n} 项`);
    }
  }catch(err){ console.warn("续做迁移失败", err); }
  finally{ migrating=false; }
}
/** 2.1.2：记录当前解锁码是不是旧短码（4–5 位）。只在内存里，不落盘、不写日志、不进 DOM。 */
function notePinLength(raw){ pinIsShort=String(raw||"").length<6; }
/** 2.1.2：旧短码解锁成功时，每 session 一次温和建议（沿用 toast，不新增界面元素）。
    只是建议，不阻断、不强制改码；密码校验与自动锁语义完全不变。 */
function suggestLongerPin(){
  if(!pinIsShort||pinShortHinted) return;
  pinShortHinted=true;
  toast("解锁码为旧短码，建议在设置 › 解锁码中改为 6–9 位");
}

/** 首次使用：把输入的数字设为解锁码（一次性确认，避免误把真实贷款金额当成码） */
function askSetPin(pin){
  /* 2.1.2：首次设置只接受 6–9 位 —— 4–5 位的输入照常当贷款金额计算，不弹「首次使用」，
     避免用户把 4 位金额误设成解锁码。旧版本已存的短码不受影响（走 unlock 路径，见上）。 */
  if(!NEW_PIN_RE.test(String(pin))){ runMortgageCalc(); return; }
  dialog({title:"首次使用", text:`将 ${pin} 设为解锁码？之后在「贷款金额」中输入它并点击「计算」即可打开私密空间。`, ok:"设为解锁码", onCancel:()=>runMortgageCalc(), onOk:async ()=>{
    try{
      await vault.create(pin);
      vaultConfigured=true;
      S.wipeOn=false;
      pinIsShort=false;
      await afterUnlock();
    }catch(err){ return err.message||"设置失败"; }
  }});
}

export async function initUI({ vault: v, media: m }){
  vault=v; media=m;
  const st=await vault.status();
  vaultConfigured=st.configured;
  S.wipeOn=st.wipeConfigured;
  /* 2.0.0 自动迁移：未建档时先探测旧库（不写库、不需要码）；上次迁移没做完也探测一次备用。
     探测结果缓存，用户点「计算」时直接用，不额外等。 */
  const pendingMigration=await legacyMigrationState();
  if(!st.configured||(pendingMigration&&pendingMigration.state==="running")) warmLegacyDetection();
  applyCurrentTheme();
  wireCalc();
  showView();
  registerSW();
  /* 进入后台立即锁定并清空密钥与 objectURL（§2）。系统文件选取器 / 导入过程中不打断。
     2.1.2：任何「要离开前台」的信号都先同步盖上计算器遮罩（见 privacyCover），再决定锁不锁。 */
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState!=="hidden"){
      privacyUncover();
      checkUpdate(false);
      if(S.view==="album") bumpAutoLock();
      return;
    }
    privacyCover();
    clearAutoLock();
    if(S.view!=="album"||S.picking||importing||migrating) return;
    lock();
  });
  /* pagehide：页面即将离开（关闭 / 刷新 / 进 bfcache）。同样先遮后锁，语义与切后台一致。 */
  window.addEventListener("pagehide",()=>{
    privacyCover();
    if(S.view!=="album"||S.picking||importing||migrating) return;
    lock();
  });
  /* blur / focus：只遮不锁 —— 系统文件选择器、输入弹窗、控制中心这类临时失焦不该把相册锁掉；
     回到前台时如果没锁就原样还原。dialog 是页内弹层，不会触发 window blur，互不影响。 */
  window.addEventListener("blur",()=>{ privacyCover(); });
  window.addEventListener("focus",()=>{ privacyUncover(); if(S.view==="album") bumpAutoLock(); });
  /* 自动锁定：任意指针/触摸/键盘/滚动/输入都重置计时 */
  const alBump=(e)=>{
    if(S.view!=="album") return;
    /* 进度/确认弹层上的操作也算活动 */
    bumpAutoLock();
  };
  ["pointerdown","touchstart","keydown","wheel","scroll","input"].forEach(n=>{
    document.addEventListener(n, alBump, {capture:true, passive:true});
  });
}
