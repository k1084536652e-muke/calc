/**
 * 2.0.0 → 2.1.0 **自动迁移**的接线层（chunk-08a）。
 *
 * 用户已拍板：2.1.0 与 2.0.0 部署在同一 origin（同 IndexedDB），迁移**不新增任何可见 UI**：
 * 「贷款金额」里输入的数字既是新解锁码也是旧解锁码（迁移时用同一个码建档）。
 *
 * 本文件只做逻辑，不碰 DOM / 样式：
 *   1) 淘汰旧库探测（warmLegacyDetection）：启动时跑一次并缓存，不写库
 *   2) 迁移（migrateLegacy）：用同一个码打开旧库 → 建档 + 解锁 → 写新库 → 记住状态
 *   3) 状态（meta/migration2）：running / done，用来「中途被打断后下次解锁续做」
 *
 * 进度条、对话框、toast 全部由 ui.js 以 callbacks 传入（复用 §44 通用进度弹窗），
 * 所以视觉部分仍然是定稿稿，没有任何新增样式。
 *
 * 安全 / 数据约束：
 *   - 不删、不改旧库：只调用 detectLegacy / openLegacy（只读）；从不调用 deleteLegacy。
 *   - 迁移是幂等的：新库里已有同 id 条目会被 migrateTo 跳过，因此中断后可安全续跑。
 *   - 半成品保留（rollbackOnError:false）：中断时已写入的条目留在新库，下次续做；
 *     这也意味着「不会出现写了一半的条目」——migrateTo 的提交顺序是内容先、元数据最后。
 *   - 明文只在迁移期间的内存里；meta 状态里只有状态字符串、时间、计数，没有名称/内容/密钥。
 */

import * as DB from "./core/db.js";
import { detectLegacy, openLegacy, migrateTo } from "../src/migrate-2.0/index.js";

/** 迁移状态记录在 daishui-vault 的 meta store 里（明文，但只有状态 / 时间 / 计数） */
const META_KEY = "migration2";
/** 连续失败这么多次就停止自动重试，避免每次解锁都白跑一遍 */
const MAX_ATTEMPTS = 3;
/** 旧版相册主题的合法取值（旧 preferences.albumTheme） */
const THEMES = ["system", "day", "night"];

let detectionPromise = null;

const emptyTotals = () => ({ folders: 0, docs: 0, media: 0, trashed: 0, chunkRows: 0 });

/**
 * 探测本机有没有 2.0.0 数据（不需要解锁码、不写库）。结果缓存，重复调用只跑一次。
 * 未建档时启动就调用，让用户点「计算」时判定是同步的（无额外等待）。
 */
export function warmLegacyDetection() {
  if (!detectionPromise) {
    detectionPromise = detectLegacy().catch((err) => {
      console.warn("旧版本数据探测失败", err);
      return { found: false, reason: "detect-failed", sources: [], authSource: null, totals: emptyTotals() };
    });
  }
  return detectionPromise;
}

/** 读迁移状态：null（没迁移过）/ {state:"running"|"done"|"failed", attempts, ...} */
export async function legacyMigrationState() {
  try {
    const row = await DB.get("meta", META_KEY);
    const v = row && row.v;
    return v && typeof v === "object" ? v : null;
  } catch (err) {
    console.warn("读取迁移状态失败", err);
    return null;
  }
}

async function writeMigrationState(state) {
  try {
    await DB.put("meta", { k: META_KEY, v: { ...state, updatedAt: Date.now() } });
  } catch (err) {
    /* 状态写不进去不该打断迁移本身：最坏情况是下次重跑（幂等，只会多花时间） */
    console.warn("写入迁移状态失败", err);
  }
}

function shortError(err) {
  const message = String((err && err.message) || err || "未知错误");
  return message.length > 160 ? message.slice(0, 160) + "…" : message;
}

/** 进度分母：旧库的文件夹 + 文档 + 媒体条目数 */
function totalEntries(detection) {
  const t = (detection && detection.totals) || emptyTotals();
  return Math.max(1, (t.folders || 0) + (t.docs || 0) + (t.media || 0));
}

function briefCounts(result) {
  return {
    imported: result.imported, skipped: result.skipped, failed: result.failed,
    folders: result.folders, docs: result.docs, bytes: result.bytes, trashed: result.trashed,
  };
}

/** 旧版相册主题（localStorage 键与 2.1.0 相同，但 2.1.0 的 album-theme 由 theme-boot 从 calc-theme 复制，
    不一定是用户在旧版里选的相册主题）→ 首次迁移成功后落到 album-theme。 */
function applyLegacyTheme(theme) {
  if (!THEMES.includes(theme)) return;
  try {
    localStorage.setItem("album-theme", theme);
  } catch (err) {
    /* 隐私模式 / 存储被禁用：主题用默认值，不算迁移失败 */
    console.warn("迁移相册主题失败", err);
  }
}

/**
 * 用「用户在贷款金额里输入的码」打开旧库并迁移。**必须在旧库确实有数据时调用**
 * （调用方先用 warmLegacyDetection() 判断；本函数自己也会再判一次）。
 *
 * @param {object} opts
 * @param {string} opts.pin            用户输入的 4–9 位数字（旧版 4–8 位，按旧码原样使用）
 * @param {object} opts.vault          2.1.0 的 Vault 实例
 * @param {boolean} [opts.create]      true = 尚未建档（成功打开旧库后才建档）；false/省略 = 续做（已解锁）
 * @param {object} [opts.ui]           {progress({total,onCancel}) → {set({index,name,pct}), close()}}
 * @param {Function} [opts.shouldAbort] 额外中止条件
 * @returns {Promise<{
 *   status: "no-legacy"|"wrong-pin"|"no-auth"|"migrated"|"paused"|"failed",
 *   created: boolean, counts?: object, error?: string, theme?: string
 * }>}
 *   wrong-pin：这个码不是旧解锁码 —— 调用方**必须**回落到普通计算，且不要弹「首次使用」，
 *              否则用户会误建一个空的新库，旧数据就再也不会自动迁移。
 */
export async function migrateLegacy({ pin, vault, create = false, ui = {}, shouldAbort = () => false } = {}) {
  const outcome = (status, extra = {}) => ({ status, created: false, ...extra });

  const detection = await warmLegacyDetection();
  if (!detection.found) return outcome("no-legacy");

  const previous = await legacyMigrationState();
  const attempts = Number(previous && previous.attempts) || 0;
  if (!create && previous && previous.state === "done") return outcome("migrated", { counts: previous.counts, theme: previous.theme });
  if (!create && attempts >= MAX_ATTEMPTS) return outcome("failed", { error: (previous && previous.lastError) || "多次迁移失败" });

  let session = null;
  try {
    session = await openLegacy(pin, { detection });
  } catch (err) {
    /* 旧库在，但里面没有解锁设置（1.x 只有 media 的情况）：无从迁移，交回普通流程 */
    return outcome("no-auth", { error: shortError(err) });
  }
  if (!session) {
    /* 续做时打不开旧库 = 旧解锁码已经不可用（用户在新版里改过解锁码）。记一次尝试，
       到上限就停止自动重试，免得每次解锁都白派生一遍旧 KEK。 */
    if (!create) {
      const next = attempts + 1;
      await writeMigrationState({
        ...(previous || {}),
        state: next >= MAX_ATTEMPTS ? "failed" : "running",
        attempts: next,
        lastError: "旧解锁码不可用（可能已在 2.1.0 里改过解锁码）",
      });
    }
    return outcome("wrong-pin");
  }

  const total = totalEntries(detection);
  let cancelled = false;
  let progress = null;
  try {
    if (typeof ui.progress === "function") {
      progress = ui.progress({ total, onCancel: () => { cancelled = true; } });
    }
  } catch (err) {
    console.warn("迁移进度弹窗创建失败", err);
    progress = null;
  }
  const setProgress = (patch) => { try { progress && progress.set(patch); } catch { /* 进度显示失败不影响迁移 */ } };

  let created = false;
  try {
    if (create) {
      /* 建档（同一个码）+ 直接处于解锁态；已建档则只解锁，避免覆盖既有 salt/DEK */
      if (!vault.auth || !vault.auth.wrappedDek) {
        await vault.create(pin);
        created = true;
      } else if (!vault.unlocked && !(await vault.unlock(pin))) {
        return outcome("wrong-pin");
      }
    }
    if (!vault.unlocked) return outcome("wrong-pin", { created });

    await writeMigrationState({
      state: "running",
      startedAt: (previous && previous.startedAt) || Date.now(),
      source: session.dbName,
      attempts,
    });

    const result = await migrateTo(vault, {
      session,
      onProgress: (p) => {
        const imported = Number(p && p.imported) || 0;
        setProgress({ index: imported, name: (p && p.name) || "…", pct: Math.min(100, (imported / total) * 100) });
      },
      shouldAbort: () => cancelled || shouldAbort(),
      /* 半成品保留：中断后已写入的条目留在新库，下次续做（按 id 去重），不整体回滚 */
      rollbackOnError: false,
    });

    if (result.aborted) {
      setProgress({ pct: Math.min(100, (result.imported / total) * 100) });
      await writeMigrationState({
        state: "running", startedAt: (previous && previous.startedAt) || Date.now(),
        source: session.dbName, attempts: attempts + 1, counts: briefCounts(result), paused: true,
      });
      return { status: "paused", created, counts: briefCounts(result) };
    }

    const counts = briefCounts(result);
    await writeMigrationState({
      state: "done", startedAt: (previous && previous.startedAt) || Date.now(), doneAt: Date.now(),
      source: session.dbName, attempts: 0, counts, theme: result.theme || null,
      warnings: (result.warnings || []).length, failures: (result.failures || []).length,
    });
    applyLegacyTheme(result.theme);
    setProgress({ pct: 100 });
    if ((result.failures || []).length) {
      /* 不弹新面板：只留日志，失败条目在旧库里原样还在，用户可再试 */
      console.warn("迁移有未能读取的旧条目", result.failures.slice(0, 10));
    }
    return { status: "migrated", created, counts, theme: result.theme || null };
  } catch (err) {
    const next = attempts + 1;
    await writeMigrationState({
      state: next >= MAX_ATTEMPTS ? "failed" : "running",
      startedAt: (previous && previous.startedAt) || Date.now(),
      source: session.dbName, attempts: next, lastError: shortError(err),
    });
    console.error("迁移失败", err);
    return { status: "failed", created, error: shortError(err) };
  } finally {
    try { session.close(); } catch { /* 忽略 */ }
    try { progress && progress.close(); } catch { /* 忽略 */ }
  }
}
