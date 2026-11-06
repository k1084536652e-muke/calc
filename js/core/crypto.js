/**
 * 加密层：PBKDF2-SHA256 派生 KEK + AES-GCM 包裹 DEK。
 *
 * 设计（DESIGN-NOTES §2 与 TASK §2）：
 * - 数据密钥 DEK：随机 256 位，仅驻留内存；用于加密每个文件内容、每条元数据、缩略图、文档、设置。
 * - KEK：由「解锁码 + 16 字节随机盐」经 PBKDF2-SHA256 派生（iterations >= 600000）。
 * - 只持久化：盐、KDF 参数、被包裹的 DEK。**不存储解锁码，也不存储解锁码的哈希**；
 *   解锁是否成功完全由「能否用派生出的 KEK 解包 DEK」判定（AES-GCM 认证标签即校验）。
 * - 每次加密都使用新的随机 IV（12 字节）。
 * - 每条记录用 AAD 绑定自身 id/用途，防止密文在记录之间被调换。
 */

export const KDF_ITERATIONS = 600_000;
export const KDF_HASH = "SHA-256";
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const DEK_BYTES = 32;

const AAD = {
  dek: "daishui/dek/v1",
  wipe: "daishui/wipe/v1",
  item: (id) => `daishui/item/${id}`,
  thumb: (id) => `daishui/thumb/${id}`,
  blob: (id) => `daishui/blob/${id}`,
  doc: (id) => `daishui/doc/${id}`,
  prefs: "daishui/prefs/v1",
  // 分块：AAD 绑定 itemId + 块序号 + 总块数，重排/截断/跨文件搬运都会导致解密失败
  chunk: (id, index, total) => `daishui/chunk/${id}/${index}/${total}`,
  // 分块清单里的类型信息（kind/mime）单独加密，避免 chunkmeta 出现明文文件类型
  chunkMeta: (id) => `daishui/chunkmeta/${id}`,
};

export function aadFor(kind, id) {
  const f = AAD[kind];
  if (!f) throw new Error("未知的 AAD 类型");
  return typeof f === "function" ? f(id) : f;
}

/** 分块 AAD（显式签名，避免把 index/total 当成 id 传错） */
export function aadChunk(itemId, index, total) {
  if (!itemId) throw new Error("缺少 itemId");
  if (!Number.isInteger(index) || index < 0) throw new Error("块序号非法");
  if (!Number.isInteger(total) || total <= 0 || index >= total) throw new Error("块总数非法");
  return AAD.chunk(String(itemId), index, total);
}

/** 分块清单加密元数据的 AAD（与 chunk 的 AAD 分开，不能互换） */
export function aadChunkMeta(itemId) {
  if (!itemId) throw new Error("缺少 itemId");
  return AAD.chunkMeta(String(itemId));
}

const enc = new TextEncoder();

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("需要二进制数据");
}

/** PBKDF2-SHA256 → AES-GCM-256 KEK（不可导出） */
export async function deriveKek(pin, salt, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBytes(salt), iterations, hash: KDF_HASH },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** 生成随机 DEK，返回 { raw, key }；raw 仅用于包裹，key 用于数据加解密 */
export async function generateDek() {
  const raw = randomBytes(DEK_BYTES);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return { raw, key };
}

export async function importDek(raw) {
  return crypto.subtle.importKey("raw", toBytes(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** AES-GCM 加密：返回独立随机 IV 与密文（含认证标签） */
export async function seal(key, data, aad) {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad || "") },
    key,
    toBytes(data)
  );
  return { iv, ct: new Uint8Array(ct) };
}

/** AES-GCM 解密：认证失败（解锁码错误 / 数据被篡改）时抛错 */
export async function open(key, envelope, aad) {
  const { iv, ct } = envelope;
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBytes(iv), additionalData: enc.encode(aad || "") },
    key,
    toBytes(ct)
  );
  return new Uint8Array(buf);
}

export async function sealText(key, text, aad) {
  return seal(key, enc.encode(text), aad);
}

export async function openText(key, envelope, aad) {
  return new TextDecoder().decode(await open(key, envelope, aad));
}

export async function sealJson(key, value, aad) {
  return sealText(key, JSON.stringify(value), aad);
}

export async function openJson(key, envelope, aad) {
  return JSON.parse(await openText(key, envelope, aad));
}

/** 包裹 DEK（用 KEK 加密 DEK 原始字节） */
export async function wrapDek(kek, dekRaw) {
  return seal(kek, dekRaw, AAD.dek);
}

/** 解包 DEK；解锁码错误时抛 OperationError */
export async function unwrapDek(kek, wrapped) {
  return open(kek, wrapped, AAD.dek);
}

/** 紧急清除码：包裹一个随机标记值，验证方式同样是「能否解包」 */
export async function wrapWipeMarker(kek, marker) {
  return seal(kek, marker, AAD.wipe);
}

export async function unwrapWipeMarker(kek, wrapped) {
  return open(kek, wrapped, AAD.wipe);
}

/** KDF 标定辅助（仅开发/测试用）：返回一次派生的毫秒数 */
export async function timeDerive(pin, salt, iterations = KDF_ITERATIONS) {
  const t0 = performance.now();
  await deriveKek(pin, salt, iterations);
  return performance.now() - t0;
}
