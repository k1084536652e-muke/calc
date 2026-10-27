const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function bytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("无效的二进制数据");
}

function equalBytes(left, right) {
  const a = bytes(left);
  const b = bytes(right);
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

async function deriveMaterial(pin, salt) {
  const pinKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: bytes(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    pinKey,
    256
  );
}

async function importAesKey(material) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    material,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function makeVerifier(material) {
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", material)
  );
}

export class VaultCrypto {
  #aesKey = null;

  get isUnlocked() {
    return this.#aesKey !== null;
  }

  async derivePin(pin) {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error("PIN 必须为 4–8 位数字");
    }

    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const material = await deriveMaterial(pin, salt);
    const verifier = await makeVerifier(material);
    const key = await importAesKey(material);

    return {
      auth: {
        salt,
        verifier,
      },
      key,
    };
  }

  async verifyPin(pin, auth) {
    if (!auth || !auth.salt || !auth.verifier || !/^\d{4,8}$/.test(pin)) {
      return null;
    }

    const material = await deriveMaterial(pin, auth.salt);
    const candidate = await makeVerifier(material);
    if (!equalBytes(candidate, auth.verifier)) {
      return null;
    }

    return importAesKey(material);
  }

  installKey(key) {
    if (!(key instanceof globalThis.CryptoKey)) {
      throw new TypeError("无效的加密密钥");
    }
    this.#aesKey = key;
  }

  lock() {
    this.#aesKey = null;
  }

  async encrypt(data, key = this.#aesKey) {
    if (!key) {
      throw new Error("金库已锁定");
    }

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return { iv, ciphertext };
  }

  async decrypt(ciphertext, iv, key = this.#aesKey) {
    if (!key) {
      throw new Error("金库已锁定");
    }

    return globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(iv) },
      key,
      ciphertext
    );
  }
}

