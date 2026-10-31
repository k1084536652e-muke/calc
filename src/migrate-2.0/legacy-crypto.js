/**
 * 2.0.0 密钥派生与解密（纯 WebCrypto，无 IndexedDB、无 DOM）。
 *
 * 只做三件事：
 *   1. 按旧参数派生 KEK / 旧数据密钥（PBKDF2-SHA256）；
 *   2. 解包旧 DEK（auth.version === 2）或校验旧 verifier（1.x 形态）；
 *   3. 用拿到的密钥解密旧的 {iv, ciphertext} 信封。
 *
 * 明文边界：派生出的密钥字节、解密出的明文**只在本次调用栈内存里存在**，
 * 用完立即 fill(0)；本模块不写日志、不落盘、不缓存。
 * Node 20+ 自带 globalThis.crypto.subtle，因此本文件可直接在 Node 里单测。
 */

import { LEGACY_CRYPTO } from "./legacy-format.js";

const encoder = new TextEncoder();

export class LegacyFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "LegacyFormatError";
  }
}

export function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("需要二进制数据");
}

export function equalBytes(a, b) {
  const x = toBytes(a);
  const y = toBytes(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function clearBytes(value) {
  if (value instanceof Uint8Array) value.fill(0);
}

function subtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new LegacyFormatError("环境不支持 WebCrypto");
  return c.subtle;
}

/** PBKDF2-SHA256 → 32 字节材料（旧版：材料既当 KEK 又当 1.x 数据密钥） */
export async function deriveLegacyMaterial(pin, salt, iterations = LEGACY_CRYPTO.iterations) {
  const base = await subtle().importKey("raw", encoder.encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", salt: toBytes(salt), iterations, hash: LEGACY_CRYPTO.hash },
    base,
    LEGACY_CRYPTO.bits
  );
  return new Uint8Array(bits);
}

/** 材料 → AES-GCM CryptoKey */
export async function importLegacyAesKey(material, extractable = false) {
  return subtle().importKey("raw", toBytes(material), { name: LEGACY_CRYPTO.cipher }, extractable, ["encrypt", "decrypt"]);
}

export async function sha256(bytes) {
  return new Uint8Array(await subtle().digest("SHA-256", toBytes(bytes)));
}

/** 校验 1.x 形态的 auth：verifier = SHA-256(PBKDF2(pin, salt, iterations)) */
export async function verifyLegacyVerifierAuth(pin, auth) {
  if (!auth || !auth.salt || !auth.verifier) return false;
  const iterations = Number(auth.iterations) || LEGACY_CRYPTO.legacyIterations;
  const material = await deriveLegacyMaterial(pin, auth.salt, iterations);
  try {
    return equalBytes(await sha256(material), auth.verifier);
  } finally {
    clearBytes(material);
  }
}

/** 解密一个旧信封 {iv, ciphertext}（无 AAD） */
export async function decryptLegacyEnvelope(key, envelope) {
  if (!envelope || !envelope.iv || !envelope.ciphertext) {
    throw new LegacyFormatError("密文信封缺少 iv 或 ciphertext");
  }
  const iv = toBytes(envelope.iv);
  if (iv.length !== LEGACY_CRYPTO.ivBytes) {
    throw new LegacyFormatError(`iv 长度异常：${iv.length}`);
  }
  const plain = await subtle().decrypt(
    { name: LEGACY_CRYPTO.cipher, iv, tagLength: LEGACY_CRYPTO.tagBits },
    key,
    toBytes(envelope.ciphertext)
  );
  return new Uint8Array(plain);
}

/** 解密旧 JSON 信封（元数据 / 文档 / 文件夹 / 设置） */
export async function decryptLegacyJson(key, envelope) {
  const plain = await decryptLegacyEnvelope(key, envelope);
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } finally {
    clearBytes(plain);
  }
}

/** 用旧 DEK 解包 wrappedLegacyKey（1.x 数据密钥） */
export async function unwrapLegacyDataKey(masterKey, wrapped) {
  if (!wrapped || !wrapped.iv || !wrapped.ciphertext) return null;
  const raw = await subtle().decrypt(
    {
      name: LEGACY_CRYPTO.cipher,
      iv: toBytes(wrapped.iv),
      additionalData: encoder.encode(LEGACY_CRYPTO.masterKeyAad),
      tagLength: LEGACY_CRYPTO.tagBits,
    },
    masterKey,
    toBytes(wrapped.ciphertext)
  );
  try {
    return await importLegacyAesKey(new Uint8Array(raw));
  } finally {
    clearBytes(new Uint8Array(raw));
  }
}

/**
 * 用旧解锁码打开旧库的密钥会话。
 *
 * @param {string} pin 2.0.0 的解锁码（4–8 位数字）
 * @param {object} auth 旧 `settings` 里的 auth 记录
 * @returns {Promise<null | {
 *   authVersion: 2 | 1,
 *   iterations: number,
 *   masterKey: CryptoKey,      // 旧 DEK（元数据/分块/缩略图）
 *   legacyKey: CryptoKey|null, // 1.x 整文件密文的密钥；没有 wrappedLegacyKey 时为 null
 *   hasLegacyRecords: boolean
 * }>} 解锁码错误返回 null（GCM 认证失败 / verifier 不符），格式不认识则抛错
 */
export async function openLegacySession(pin, auth) {
  if (!auth) return null;
  if (!/^\d{4,8}$/.test(String(pin ?? ""))) return null;

  // 形态 A：2.0.0 当前形态（DEK + 包裹）
  if (Number(auth.version) === 2 && auth.wrappedMasterKey) {
    const iterations = Number(auth.iterations) || LEGACY_CRYPTO.iterations;
    const material = await deriveLegacyMaterial(pin, auth.salt, iterations);
    try {
      const kek = await importLegacyAesKey(material);
      let raw;
      try {
        const plain = await subtle().decrypt(
          {
            name: LEGACY_CRYPTO.cipher,
            iv: toBytes(auth.wrappedMasterKey.iv),
            additionalData: encoder.encode(LEGACY_CRYPTO.masterKeyAad),
            tagLength: LEGACY_CRYPTO.tagBits,
          },
          kek,
          toBytes(auth.wrappedMasterKey.ciphertext)
        );
        raw = new Uint8Array(plain);
      } catch {
        return null; // 认证失败 ⇒ 旧解锁码不对
      }
      try {
        const masterKey = await importLegacyAesKey(raw);
        let legacyKey = null;
        if (auth.wrappedLegacyKey) {
          legacyKey = await unwrapLegacyDataKey(masterKey, auth.wrappedLegacyKey).catch(() => null);
        }
        return {
          authVersion: 2,
          iterations,
          masterKey,
          legacyKey,
          hasLegacyRecords: !!auth.wrappedLegacyKey,
        };
      } finally {
        clearBytes(raw);
      }
    } finally {
      clearBytes(material);
    }
  }

  // 形态 B：1.x verifier 形态（材料直接当数据密钥）
  if (auth.salt && auth.verifier) {
    const iterations = Number(auth.iterations) || LEGACY_CRYPTO.legacyIterations;
    const material = await deriveLegacyMaterial(pin, auth.salt, iterations);
    let ok = false;
    try {
      ok = equalBytes(await sha256(material), auth.verifier);
      if (!ok) return null;
      const key = await importLegacyAesKey(material);
      return { authVersion: 1, iterations, masterKey: key, legacyKey: key, hasLegacyRecords: true };
    } finally {
      clearBytes(material);
    }
  }

  throw new LegacyFormatError("无法识别的旧版 auth 记录");
}

// ---------------------------------------------------------------------------
// 以下仅供测试构造「旧格式」样本与未来写回/校验使用，迁移流程本身不写旧库。
// ---------------------------------------------------------------------------

/** 按旧参数加密一个信封（无 AAD） */
export async function encryptLegacyEnvelope(key, bytes) {
  const iv = new Uint8Array(LEGACY_CRYPTO.ivBytes);
  globalThis.crypto.getRandomValues(iv);
  const ct = await subtle().encrypt({ name: LEGACY_CRYPTO.cipher, iv, tagLength: LEGACY_CRYPTO.tagBits }, key, toBytes(bytes));
  return { iv, ciphertext: new Uint8Array(ct) };
}

/** 按旧参数包裹 32 字节材料（AAD = masterKeyAad） */
export async function wrapLegacyKeyMaterial(kek, material) {
  const iv = new Uint8Array(LEGACY_CRYPTO.ivBytes);
  globalThis.crypto.getRandomValues(iv);
  const ct = await subtle().encrypt(
    {
      name: LEGACY_CRYPTO.cipher,
      iv,
      additionalData: encoder.encode(LEGACY_CRYPTO.masterKeyAad),
      tagLength: LEGACY_CRYPTO.tagBits,
    },
    kek,
    toBytes(material)
  );
  return { iv, ciphertext: new Uint8Array(ct) };
}
