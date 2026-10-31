/**
 * 2.0.0 → 2.1.0 数据迁移模块（隔离实现）
 *
 * ⚠️ 默认未接入主流程。本模块**不被 index.html / js/ui.js / js/core/* 引用**，
 *    也不会自动运行；接入方式、方案取舍与风险见 NOTES-xiaoma.md「迁移方案」
 *    与本目录 README.md。是否接入、接在哪里，由 PM 决定。
 *
 * 对外 API（全部显式调用，无副作用的自启动逻辑）：
 *   detectLegacy()                     检测旧库是否存在、各表条目数（不需要解锁码）
 *   openLegacy(pin)                    用旧解锁码派生/解包旧密钥；错码返回 null
 *   readLegacyItems(handle, opts)      异步迭代：逐条解密出文件夹 / 文档 / 媒体
 *   migrateTo(repo, {session, ...})    写入 2.1.0 仓储（用 repo 的公开方法），默认不删旧库
 *   deleteLegacy(handle)               仅显式调用才删旧库
 *
 * 安全与数据约束：
 *   - 旧明文只在单条处理期间存在内存；日志/错误信息不含明文、密钥、解锁码。
 *   - 写库顺序：内容（blob / thumb / doc）→ 元数据（item）。元数据是提交点，
 *     中断不会留下「有索引没内容」的坏条目。
 *   - 失败默认回滚本次写入（purgeItems / deleteFolders），旧库原样保留。
 *   - 幂等：目标库已存在同 id 条目则跳过，可安全重跑。
 */

import {
  LEGACY_DB, LEGACY_CRYPTO, LEGACY_APP_VERSION,
  legacyFolderToNewFolder, legacyMediaToNewItem, legacyTextToNewItem,
  legacyTextHtml, legacyPreferencesToSettings, coverIdsFor, newKindForLegacy,
} from "./legacy-format.js";
import { LegacyFormatError, clearBytes, decryptLegacyEnvelope, decryptLegacyJson, openLegacySession } from "./legacy-crypto.js";
import {
  closeDatabase, countStore, deleteDatabase, hasIndexedDb, iterateStore,
  listDatabaseNames, looksLikeLegacyVault, openLegacyDatabase, probeDatabase, readSetting,
} from "./legacy-db.js";

export { LEGACY_DB, LEGACY_CRYPTO, LEGACY_APP_VERSION, LegacyFormatError };
export { legacyPreferencesToSettings, coverIdsFor };

const noop = () => {};

// ---------------------------------------------------------------------------
// 1. 检测
// ---------------------------------------------------------------------------

/**
 * 检测本机是否存在 2.0.0 数据。
 * @returns {Promise<{
 *   found: boolean,
 *   reason?: string,
 *   sources: Array<object>,          // 每个库的探测结果（存在性 / 版本 / stores / counts）
 *   authSource: string | null,       // 哪个库里有解锁设置（迁移需要它）
 *   totals: { folders:number, docs:number, media:number, trashed:number, chunkRows:number }
 * }>}
 */
export async function detectLegacy() {
  if (!hasIndexedDb()) {
    return { found: false, reason: "no-indexeddb", sources: [], authSource: null, totals: emptyTotals() };
  }

  const names = await listDatabaseNames();
  const sources = [];
  for (const name of LEGACY_DB.order) {
    if (names && !names.includes(name)) continue; // 不存在就别 open（避免建空库）
    sources.push(await probeDatabase(name));
  }

  const usable = sources.filter((p) => p.exists && looksLikeLegacyVault(p));
  const totals = emptyTotals();
  let authSource = null;
  for (const probe of usable) {
    const counts = probe.counts || {};
    totals.folders += (counts.folders || 0) + (counts.trashFolders || 0);
    totals.docs += (counts.texts || 0) + (counts.trashTexts || 0);
    totals.media += (counts.meta || 0) + (counts.trashMeta || 0) + (counts.media || 0);
    totals.trashed += (counts.trashMeta || 0) + (counts.trashTexts || 0) + (counts.trashFolders || 0);
    totals.chunkRows += counts.chunks || 0;
    if (!authSource && probe.hasAuth) authSource = probe.name;
  }

  return {
    found: usable.length > 0,
    reason: usable.length ? undefined : "not-found",
    sources,
    authSource,
    totals,
  };
}

function emptyTotals() {
  return { folders: 0, docs: 0, media: 0, trashed: 0, chunkRows: 0 };
}

// ---------------------------------------------------------------------------
// 2. 用旧解锁码打开会话
// ---------------------------------------------------------------------------

/**
 * 用 2.0.0 解锁码解开旧密钥。
 * @param {string} pin
 * @param {{detection?: object}} [options] 可传入 detectLegacy() 结果，省一次探测
 * @returns {Promise<null | {
 *   pin: string, dbName: string, authVersion: number, iterations: number,
 *   masterKey: CryptoKey, legacyKey: CryptoKey|null,
 *   detection: object, close: () => void
 * }>} 错码返回 null；找不到旧库抛 LegacyFormatError
 */
export async function openLegacy(pin, options = {}) {
  const detection = options.detection || (await detectLegacy());
  if (!detection.found) throw new LegacyFormatError("未检测到旧版本数据");

  const candidates = [detection.authSource, ...detection.sources.map((s) => s.name)]
    .filter((name, index, list) => name && list.indexOf(name) === index && legacySourceExists(detection, name));

  for (const name of candidates) {
    const db = await openLegacyDatabase(name);
    if (!db) continue;
    const auth = await readSetting(db, "auth").catch(() => null);
    if (!auth) { closeDatabase(db); continue; }
    const session = await openLegacySession(pin, auth);
    if (!session) { closeDatabase(db); return null; }  // 找到 auth 但解不开 ⇒ 错码

    // 打开其余源库（只读），用于 1.x 遗留 media 数据
    const handles = new Map([[name, db]]);
    for (const probe of detection.sources) {
      if (!probe.exists || handles.has(probe.name)) continue;
      const extra = await openLegacyDatabase(probe.name).catch(() => null);
      if (extra) handles.set(probe.name, extra);
    }

    return {
      pin: String(pin),
      dbName: name,
      authVersion: session.authVersion,
      iterations: session.iterations,
      masterKey: session.masterKey,
      legacyKey: session.legacyKey,
      detection,
      handles,
      close() {
        for (const handle of handles.values()) closeDatabase(handle);
        handles.clear();
      },
    };
  }

  throw new LegacyFormatError("旧版本库里没有找到解锁设置");
}

function legacySourceExists(detection, name) {
  return (detection.sources || []).some((probe) => probe.exists && probe.name === name);
}

// ---------------------------------------------------------------------------
// 3. 逐条解密读取
// ---------------------------------------------------------------------------

/**
 * 异步迭代旧库内容。顺序：settings → folders → trashed folders → docs → media。
 * 每条都是「已解密」的中间结构，交给 migrateTo 或调用方自行处理。
 *
 * @param {object} session openLegacy() 的返回值
 * @param {{onProgress?: Function, shouldAbort?: Function, includeTrash?: boolean}} [options]
 * @yields {{
 *   recordType: "settings"|"folder"|"item",
 *   store: string, legacyId: string,
 *   kind?: string, name?: string, mime?: string, size?: number, createdAt?: number,
 *   folderId?: string|null, trashedAt?: number|null,
 *   blob?: Uint8Array|null, thumb?: Uint8Array|null, html?: string,
 *   settings?: object, folder?: object, warnings: string[]
 * }}
 */
export async function* readLegacyItems(session, options = {}) {
  const { onProgress = noop, shouldAbort = () => false, includeTrash = true } = options;
  if (!session || !session.masterKey) throw new LegacyFormatError("会话无效，请先用 openLegacy(pin) 解锁");
  const masterKey = session.masterKey;

  let done = 0;
  const total = (session.detection && session.detection.totals)
    ? session.detection.totals.folders + session.detection.totals.docs + session.detection.totals.media
    : 0;

  // --- 设置（旧 preferences 是加密的）---
  const primary = session.handles.get(session.dbName);
  const prefsRecord = primary ? await readSetting(primary, "preferences").catch(() => null) : null;
  if (prefsRecord && prefsRecord.ciphertext) {
    try {
      const payload = await decryptLegacyJson(masterKey, prefsRecord);
      yield { recordType: "settings", store: "settings", legacyId: "preferences", settings: legacyPreferencesToSettings(payload), raw: payload, warnings: [] };
    } catch (error) {
      yield { recordType: "settings", store: "settings", legacyId: "preferences", settings: legacyPreferencesToSettings(null), warnings: ["旧设置解密失败，已用默认值：" + shortError(error)] };
    }
  }

  // --- 文件夹 ---
  for (const [store, trashed] of [["folders", false], ...(includeTrash ? [["trashFolders", true]] : [])]) {
    for (const handle of session.handles.values()) {
      for await (const row of iterateStore(handle, store)) {
        if (shouldAbort()) return;
        const envelope = row.value;
        let payload;
        try {
          payload = await decryptLegacyJson(masterKey, envelope);
        } catch (error) {
          done += 1;
          onProgress({ phase: "folder", done, total, name: envelope && envelope.id, error: shortError(error) });
          yield { recordType: "folder", store, legacyId: envelope && envelope.id, failed: true, warnings: ["文件夹元数据解密失败：" + shortError(error)] };
          continue;
        }
        const trashedAt = trashed ? (Number(payload.trashedAt) || Date.now()) : null;
        done += 1;
        onProgress({ phase: "folder", done, total, name: payload.name, id: payload.id });
        yield {
          recordType: "folder",
          store,
          legacyId: payload.id,
          folder: legacyFolderToNewFolder(payload, payload.id),
          name: payload.name,
          createdAt: Number(payload.createdAt) || 0,
          trashedAt,
          warnings: [],
        };
      }
    }
  }

  // --- 文档（texts / trashTexts）---
  for (const [store, trashed] of [["texts", false], ...(includeTrash ? [["trashTexts", true]] : [])]) {
    for (const handle of session.handles.values()) {
      for await (const row of iterateStore(handle, store)) {
        if (shouldAbort()) return;
        const envelope = row.value;
        let payload;
        try {
          payload = await decryptLegacyJson(masterKey, envelope);
        } catch (error) {
          done += 1;
          onProgress({ phase: "doc", done, total, name: envelope && envelope.id, error: shortError(error) });
          yield { recordType: "item", store, legacyId: envelope && envelope.id, failed: true, warnings: ["文档解密失败：" + shortError(error)] };
          continue;
        }
        const trashedAt = trashed ? (Number(payload.trashedAt) || Date.now()) : null;
        const item = legacyTextToNewItem(payload, { id: payload.id, trashedAt });
        done += 1;
        onProgress({ phase: "doc", done, total, name: item.name, id: item.id });
        yield {
          recordType: "item",
          store,
          legacyId: payload.id,
          kind: "doc",
          name: item.name,
          mime: item.mime,
          size: item.size,
          createdAt: item.createdAt,
          folderId: payload.folderId ?? null,
          trashedAt,
          html: legacyTextHtml(payload),
          item,
          warnings: [],
        };
      }
    }
  }

  // --- 媒体（meta / trashMeta：2.0.0 分块格式）---
  for (const [store, trashed] of [["meta", false], ...(includeTrash ? [["trashMeta", true]] : [])]) {
    for (const handle of session.handles.values()) {
      for await (const row of iterateStore(handle, store)) {
        if (shouldAbort()) return;
        const envelope = row.value;
        let payload;
        try {
          payload = await decryptLegacyJson(masterKey, envelope);
        } catch (error) {
          done += 1;
          onProgress({ phase: "media", done, total, name: envelope && envelope.id, error: shortError(error) });
          yield { recordType: "item", store, legacyId: envelope && envelope.id, failed: true, warnings: ["媒体元数据解密失败：" + shortError(error)] };
          continue;
        }
        const warnings = [];
        let blob = null;
        try {
          blob = await readMediaContent(masterKey, payload, envelope, handle, warnings);
        } catch (error) {
          done += 1;
          onProgress({ phase: "media", done, total, name: payload.name, error: shortError(error) });
          yield { recordType: "item", store, legacyId: payload.id, failed: true, kind: newKindForLegacy(payload.kind, payload.mimeType), name: payload.name, warnings: ["内容解密失败：" + shortError(error)] };
          continue;
        }
        const thumb = await readThumb(masterKey, payload.id, handle).catch(() => null);
        const trashedAt = trashed ? (Number(payload.trashedAt) || Date.now()) : null;
        const item = legacyMediaToNewItem(payload, { id: payload.id, trashedAt, hasThumb: !!thumb });
        if (blob && Number(payload.size) && blob.length !== Number(payload.size)) {
          warnings.push(`长度不一致：元数据 ${payload.size} / 实解 ${blob.length}`);
        }
        done += 1;
        onProgress({ phase: "media", done, total, name: item.name, id: item.id, bytes: blob ? blob.length : 0 });
        yield {
          recordType: "item",
          store,
          legacyId: payload.id,
          kind: item.kind,
          name: item.name,
          mime: item.mime,
          size: blob ? blob.length : Number(payload.size) || 0,
          createdAt: item.createdAt,
          folderId: payload.folderId ?? null,
          trashedAt,
          blob,
          thumb,
          item,
          warnings,
        };
      }
    }
  }

  // --- 1.x 遗留整文件密文（media store，需要 wrappedLegacyKey）---
  if (session.legacyKey) {
    for (const handle of session.handles.values()) {
      for await (const row of iterateStore(handle, "media")) {
        if (shouldAbort()) return;
        const record = row.value;
        const warnings = [];
        let blob;
        try {
          blob = await decryptLegacyEnvelope(session.legacyKey, record);
        } catch (error) {
          done += 1;
          onProgress({ phase: "legacy", done, total, name: record && record.id, error: shortError(error) });
          yield { recordType: "item", store: "media", legacyId: record && record.id, failed: true, name: record && record.name, warnings: ["1.x 内容解密失败：" + shortError(error)] };
          continue;
        }
        let thumb = null;
        if (record.thumbnailCiphertext && record.thumbnailIv) {
          try {
            thumb = await decryptLegacyEnvelope(session.legacyKey, { iv: record.thumbnailIv, ciphertext: record.thumbnailCiphertext });
          } catch {
            warnings.push("1.x 缩略图解密失败，已跳过封面");
          }
        }
        const payload = {
          id: record.id,
          name: record.name,
          kind: record.kind,
          mimeType: record.mimeType,
          size: blob.length,
          createdAt: record.createdAt,
          folderId: record.folderId ?? null,
        };
        const item = legacyMediaToNewItem(payload, { id: record.id, hasThumb: !!thumb });
        done += 1;
        onProgress({ phase: "legacy", done, total, name: item.name, id: item.id, bytes: blob.length });
        yield {
          recordType: "item",
          store: "media",
          legacyId: record.id,
          kind: item.kind,
          name: item.name,
          mime: item.mime,
          size: blob.length,
          createdAt: item.createdAt,
          folderId: payload.folderId,
          trashedAt: null,
          blob,
          thumb,
          item,
          warnings,
        };
      }
    }
  } else if (hasLegacyMediaStore(session)) {
    yield {
      recordType: "item",
      store: "media",
      legacyId: "",
      failed: true,
      warnings: ["旧库里有 1.x 整文件密文但没有 wrappedLegacyKey，这部分无法解密，需要人工处理"],
    };
  }
}

function hasLegacyMediaStore(session) {
  return (session.detection && session.detection.sources || []).some(
    (probe) => probe.exists && (probe.counts || {}).media > 0
  );
}

/** 读一条媒体的内容：优先分块（2.0.0），退回整条密文（防御） */
async function readMediaContent(masterKey, payload, envelope, handle, warnings) {
  const chunkCount = Number(payload.chunkCount);
  if (Number.isInteger(chunkCount) && chunkCount > 0) {
    if (!handle.objectStoreNames.contains("chunks")) throw new Error("缺少 chunks store");
    const size = Number(payload.size) || 0;
    const out = size > 0 ? new Uint8Array(size) : null;
    const parts = [];
    let offset = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      const tx = handle.transaction("chunks", "readonly");
      const row = await new Promise((resolve, reject) => {
        const request = tx.objectStore("chunks").get([payload.id, index]);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("读取内容分块失败"));
      });
      if (!row) throw new Error(`缺少第 ${index} 块内容`);
      const plain = await decryptLegacyEnvelope(masterKey, row);
      if (out && offset + plain.length <= out.length) {
        out.set(plain, offset);
      } else {
        parts.push(plain);
      }
      offset += plain.length;
      clearBytes(plain);
    }
    if (out && offset === out.length) return out;
    // 尺寸与元数据不符：按实际拼接结果返回（由调用方记录警告）
    const joined = new Uint8Array(offset);
    let cursor = 0;
    if (out) { joined.set(out.subarray(0, Math.min(offset, out.length)), 0); cursor = Math.min(offset, out.length); }
    for (const part of parts) { joined.set(part, cursor); cursor += part.length; }
    warnings.push(`元数据 size=${payload.size} 与实际长度 ${offset} 不一致，已按实际长度写入`);
    return joined;
  }

  if (envelope && envelope.ciphertext && envelope.iv) {
    warnings.push("该条目是整条密文格式（非分块），已按整条解密");
    return decryptLegacyEnvelope(masterKey, envelope);
  }
  throw new Error("条目不包含可解密的内容");
}

async function readThumb(masterKey, mediaId, handle) {
  if (!handle.objectStoreNames.contains("thumbs")) return null;
  const tx = handle.transaction("thumbs", "readonly");
  const row = await new Promise((resolve, reject) => {
    const request = tx.objectStore("thumbs").get(mediaId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("读取缩略图失败"));
  });
  if (!row || !row.ciphertext) return null;
  return decryptLegacyEnvelope(masterKey, row);
}

// ---------------------------------------------------------------------------
// 4. 写入 2.1.0
// ---------------------------------------------------------------------------

/**
 * 把旧库内容写入 2.1.0 仓储。**默认不删除旧库**。
 *
 * 只调用 repo 的公开方法：createFolder / saveFolder / saveSettings / putBlob /
 * putThumb / saveDoc / saveItem / purgeItems / deleteFolders / loadAll。
 *
 * @param {object} repo 2.1.0 的 Vault 实例（需已解锁）
 * @param {{
 *   session: object,                    // openLegacy() 的返回值（必填）
 *   onProgress?: (p:object)=>void,
 *   shouldAbort?: ()=>boolean,
 *   dryRun?: boolean,
 *   skipIds?: Iterable<string>,
 *   migrateSettings?: boolean,          // 默认 true
 *   includeTrash?: boolean,             // 默认 true（回收站内容按 trashedAt 还原）
 *   rollbackOnError?: boolean           // 默认 true：失败时撤销本次写入
 * }} options
 * @returns {Promise<{
 *   imported:number, skipped:number, failed:number, folderFailures:number,
 *   folders:number, skippedFolders:number, docs:number, bytes:number, trashed:number,
 *   warnings:Array<{id:string,name?:string,message:string}>,
 *   failures:Array<{id:string,name?:string,message:string}>,
 *   rolledBack:boolean, verified:boolean|null, dryRun:boolean,
 *   theme:string|null
 * }>}
 */
export async function migrateTo(repo, options = {}) {
  const {
    session, onProgress = noop, shouldAbort = () => false,
    dryRun = false, skipIds = [], migrateSettings = true,
    includeTrash = true, rollbackOnError = true,
  } = options;

  if (!session) throw new LegacyFormatError("migrateTo 需要 session（先调用 openLegacy(pin)）");
  if (!dryRun && !repo) throw new LegacyFormatError("migrateTo 需要已解锁的 2.1.0 仓储");
  if (!dryRun && !repo.unlocked) throw new LegacyFormatError("目标仓储未解锁，无法写入");

  const skippedSet = new Set(skipIds);
  const existing = new Set((repo && repo.items ? repo.items : []).map((it) => it.id));
  const folderMap = new Map();        // 旧文件夹 id → 新文件夹 id
  const newFolders = [];              // 本次创建的文件夹（回滚时删掉）
  const touchedFolders = [];          // 本次涉及的文件夹（新建的 + 续做时复用的），用于算封面
  const writtenIds = [];
  const warnings = [];
  const failures = [];

  /* 续做：上次已经建过的旧文件夹要「认亲」复用，不能重复建（否则中断一次就多一份同名文件夹）。
     认亲靠文件夹上的 migratedFrom.legacyId（新建时写入，见下面 folder 分支）。 */
  const knownFolders = new Map(
    ((repo && repo.folders) || [])
      .filter((f) => f && f.migratedFrom && f.migratedFrom.legacyId)
      .map((f) => [f.migratedFrom.legacyId, f])
  );

  const result = {
    imported: 0, skipped: 0, failed: 0, folderFailures: 0, folders: 0, skippedFolders: 0,
    docs: 0, bytes: 0, trashed: 0,
    warnings, failures, rolledBack: false, verified: null, dryRun,
    theme: null,   // 旧 preferences.albumTheme（2.1.0 存在 localStorage，由调用方落地）
  };

  const report = (extra) => onProgress({ phase: "migrate", imported: result.imported, ...extra });

  try {
    for await (const entry of readLegacyItems(session, { onProgress, shouldAbort, includeTrash })) {
      if (shouldAbort()) throw new AbortError();

      if (entry.recordType === "settings") {
        if (!dryRun && migrateSettings && entry.settings) {
          /* theme 不是 2.1.0 的 settings 字段（主题在 localStorage），从补丁里摘出来交给调用方，
             不要顺手写进 prefs —— 免得 settings 形状被旧字段污染。 */
          const { theme, ...patch } = entry.settings;
          if (theme) result.theme = theme;
          await repo.saveSettings(patch);
        }
        continue;
      }

      if (entry.recordType === "folder") {
        if (entry.failed || !entry.folder) {
          failures.push({ id: entry.legacyId || "", kind: "folder", message: (entry.warnings || ["文件夹读取失败"]).join("；") });
          result.folderFailures += 1;
          continue;
        }
        if (entry.trashedAt) {
          // 2.1.0 没有「回收站里的文件夹」概念：删除态文件夹不重建，其内容按回收站条目还原到根目录。
          warnings.push({ id: entry.legacyId, name: entry.name, message: "旧版已删除的文件夹不重建，其内容按回收站条目还原到根目录" });
          continue;
        }
        if (dryRun) { result.folders += 1; report({ name: entry.name }); continue; }
        if (knownFolders.has(entry.legacyId)) {
          // 上次迁移已建过这个文件夹（续做）：直接复用，不重复创建
          const known = knownFolders.get(entry.legacyId);
          folderMap.set(entry.legacyId, known.id);
          touchedFolders.push(known);
          result.skippedFolders += 1;
          continue;
        }
        const created = await repo.createFolder(entry.name || "文件夹");
        created.migratedFrom = { app: LEGACY_APP_VERSION, legacyId: entry.legacyId };
        await repo.saveFolder(created);
        folderMap.set(entry.legacyId, created.id);
        newFolders.push(created);
        touchedFolders.push(created);
        result.folders += 1;
        report({ name: created.n, folder: true });
        continue;
      }

      // --- 条目 ---
      // 先处理失败项（有的失败项连 id 都没有，例如「有 1.x 密文但没有 wrappedLegacyKey」），
      // 这类必须计入失败并出现在报告里，**不能静默跳过**（否则等于悄悄丢数据）。
      if (entry.failed) {
        failures.push({ id: entry.legacyId || "", name: entry.name, store: entry.store, message: (entry.warnings || ["读取失败"]).join("；") || "读取失败" });
        result.failed += 1;
        continue;
      }

      const id = entry.legacyId || (entry.item && entry.item.id);
      if (!id) { continue; }
      if (skippedSet.has(id) || existing.has(id)) { result.skipped += 1; continue; }

      if (!entry.item) {
        failures.push({ id, name: entry.name, store: entry.store, message: "无法转换成新格式条目" });
        result.failed += 1;
        continue;
      }

      for (const message of entry.warnings || []) warnings.push({ id, name: entry.name, message });

      const mappedFolder = entry.folderId && folderMap.has(entry.folderId) ? folderMap.get(entry.folderId) : null;
      if (entry.folderId && !mappedFolder) {
        warnings.push({ id, name: entry.name, message: "所属文件夹不可迁移（已删除或读取失败），条目落到根目录" });
      }
      const item = { ...entry.item, folderIds: mappedFolder ? [mappedFolder] : [] };
      if (entry.trashedAt) { item.trashedAt = entry.trashedAt; result.trashed += 1; }

      if (dryRun) {
        result.imported += 1;
        result.bytes += Number(entry.size) || 0;
        if (item.kind === "doc") result.docs += 1;
        report({ name: item.name, id, bytes: Number(entry.size) || 0 });
        continue;
      }

      // 提交顺序：内容 → 缩略图 → 文档正文 → 元数据（元数据是提交点）
      // 先把 id 记入 writtenIds：即使 saveItem 失败，已经落盘的内容也要能在回滚时清掉
      // （否则会留下永远不可见的孤儿密文，白占空间）。
      writtenIds.push(id);
      if (entry.blob) await repo.putBlob(id, entry.blob);
      if (entry.thumb) await repo.putThumb(id, entry.thumb);
      if (item.kind === "doc" && typeof entry.html === "string") await repo.saveDoc(id, entry.html);
      item.hasThumb = !!entry.thumb;
      await repo.saveItem(item);

      existing.add(id);
      result.imported += 1;
      result.bytes += Number(entry.size) || 0;
      if (item.kind === "doc") result.docs += 1;
      report({ name: item.name, id, bytes: Number(entry.size) || 0 });
    }

    if (dryRun) {
      return result;
    }

    // 刷新内存索引，让迁移结果立即可见（封面也按刷新后的索引算，续做时不会漏掉上次写入的条目）
    if (typeof repo.loadAll === "function") await repo.loadAll();

    // 文件夹封面（旧版运行时算，2.1.0 持久化）
    const covers = [];
    const coverSource = repo.items && repo.items.length ? repo.items : [];
    for (const folder of touchedFolders) {
      const ids = coverIdsFor(coverSource, folder.id);
      if (!ids.length) continue;
      if ((folder.coverIds || []).join(",") === ids.join(",")) continue;
      folder.coverIds = ids;
      covers.push(folder);
    }
    if (covers.length) await repo.saveFolders(covers);

    result.verified = await verifyMigration(repo, session, result, writtenIds);
    report({ done: true, verified: result.verified });
    return result;
  } catch (error) {
    const aborted = error && error.name === "AbortError";
    if (!dryRun && rollbackOnError && writtenIds.length) {
      try {
        await repo.purgeItems(writtenIds);
        if (newFolders.length) await repo.deleteFolders(newFolders.map((f) => f.id));
        if (typeof repo.loadAll === "function") await repo.loadAll();
        result.rolledBack = true;
      } catch (rollbackError) {
        result.rollbackError = shortError(rollbackError);
      }
    }
    if (aborted) {
      result.aborted = true;
      return result;
    }
    throw error;
  }
}

/** 迁移后校验：条目数 + 逐条能读回内容（只校验本次写入的媒体） */
async function verifyMigration(repo, session, result, writtenIds) {
  try {
    const expected = session.detection && session.detection.totals
      ? session.detection.totals.media + session.detection.totals.docs
      : null;
    const counted = result.imported + result.skipped + result.failed;
    const countOk = expected === null ? null : counted === expected;

    let readBackOk = true;
    const sample = writtenIds.slice(0, 5);
    for (const id of sample) {
      const item = (repo.items || []).find((it) => it.id === id);
      if (!item) { readBackOk = false; break; }
      if (item.kind === "doc") {
        const html = await repo.readDoc(id);
        if (typeof html !== "string") { readBackOk = false; break; }
      } else if (item.size > 0) {
        const bytes = await repo.readBlob(id);
        if (!bytes || bytes.length !== item.size) { readBackOk = false; break; }
      }
    }
    return { countOk, readBackOk, expected, counted };
  } catch {
    return null;
  }
}

/**
 * 删除旧库（**默认迁移流程不调用**）。只有用户明确确认「旧数据已在新版里核对无误」后才允许。
 * @param {object} session openLegacy() 返回值（也可传 {detection} 只删库）
 * @param {{confirm?: string}} [options] 必须传 confirm:"delete-legacy"，防止误调用
 */
export async function deleteLegacy(session, options = {}) {
  if (options.confirm !== "delete-legacy") {
    throw new Error('删除旧库需要显式确认：deleteLegacy(session, { confirm: "delete-legacy" })');
  }
  if (session && typeof session.close === "function") session.close();
  const names = [];
  const detection = session && session.detection ? session.detection : await detectLegacy();
  for (const probe of detection.sources || []) {
    if (!probe.exists) continue;
    await deleteDatabase(probe.name);
    names.push(probe.name);
  }
  return names;
}

/** 旧库剩余条目数（删除前的最后一道核对用） */
export async function countLegacyEntries(session) {
  const counts = {};
  for (const [name, db] of session.handles || []) {
    counts[name] = {
      meta: await countStore(db, "meta"),
      chunks: await countStore(db, "chunks"),
      texts: await countStore(db, "texts"),
      folders: await countStore(db, "folders"),
      media: await countStore(db, "media"),
    };
  }
  return counts;
}

function shortError(error) {
  const message = String((error && error.message) || error || "未知错误");
  return message.length > 120 ? message.slice(0, 120) + "…" : message;
}

class AbortError extends Error {
  constructor() {
    super("迁移已中断");
    this.name = "AbortError";
  }
}
