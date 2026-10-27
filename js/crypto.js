export const PBKDF2_ITERATIONS = 600_000;
export const LEGACY_PBKDF2_ITERATIONS = 100_000;
export const MASTER_KEY_BYTES = 32;

const encoder = new TextEncoder();
const MASTER_KEY_AAD = encoder.encode("local-tool/master-key/v2");

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

function validCode(code) {
  return /^\d{4,8}$/.test(code);
}

function randomBytes(length) {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function clearBytes(value) {
  if (value instanceof Uint8Array) {
    value.fill(0);
  }
}

async function derivePinMaterial(pin, salt, iterations) {
  const pinKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: bytes(salt),
        iterations,
        hash: "SHA-256",
      },
      pinKey,
      256
    )
  );
}

async function importAesKey(material, extractable = false) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    material,
    { name: "AES-GCM" },
    extractable,
    ["encrypt", "decrypt"]
  );
}

async function wrapBytes(key, plain, additionalData) {
  const iv = randomBytes(12);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData,
    },
    key,
    plain
  );
  return { iv, ciphertext };
}

async function unwrapBytes(key, wrapped, additionalData) {
  return new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(wrapped.iv),
        additionalData,
      },
      key,
      wrapped.ciphertext
    )
  );
}

async function makeVerifier(material) {
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", material)
  );
}

function createMasterMaterial() {
  return randomBytes(MASTER_KEY_BYTES);
}

async function wrapMasterWithPin(masterRaw, pin) {
  const salt = randomBytes(16);
  const pinMaterial = await derivePinMaterial(
    pin,
    salt,
    PBKDF2_ITERATIONS
  );
  try {
    const kek = await importAesKey(pinMaterial);
    const wrappedMasterKey = await wrapBytes(
      kek,
      masterRaw,
      MASTER_KEY_AAD
    );
    return {
      salt,
      iterations: PBKDF2_ITERATIONS,
      wrappedMasterKey,
    };
  } finally {
    clearBytes(pinMaterial);
  }
}

async function unwrapMasterWithPin(pin, auth) {
  const pinMaterial = await derivePinMaterial(
    pin,
    auth.salt,
    auth.iterations || PBKDF2_ITERATIONS
  );
  try {
    const kek = await importAesKey(pinMaterial);
    return await unwrapBytes(
      kek,
      auth.wrappedMasterKey,
      MASTER_KEY_AAD
    );
  } finally {
    clearBytes(pinMaterial);
  }
}

export class DataCrypto {
  #masterKey = null;

  get isUnlocked() {
    return this.#masterKey !== null;
  }

  get masterKey() {
    return this.#masterKey;
  }

  /**
   * Creates a random master key and stores only its PIN-wrapped form.
   * The returned session key is deliberately non-extractable.
   */
  async createCredentials(pin) {
    if (!validCode(pin)) {
      throw new Error("解锁码必须为 4–8 位数字");
    }

    const masterRaw = createMasterMaterial();
    try {
      const wrapper = await wrapMasterWithPin(masterRaw, pin);
      const key = await importAesKey(masterRaw);
      return {
        auth: {
          key: "auth",
          version: 2,
          ...wrapper,
          wrappedLegacyKey: null,
        },
        key,
      };
    } finally {
      clearBytes(masterRaw);
    }
  }

  /**
   * Returns a non-extractable master key on success. Wrong PINs fail GCM
   * authentication while unwrapping the master key.
   */
  async unlock(pin, auth) {
    if (!auth || !validCode(pin)) {
      return null;
    }

    if (auth.version === 2 && auth.wrappedMasterKey) {
      try {
        const masterRaw = await unwrapMasterWithPin(pin, auth);
        try {
          const key = await importAesKey(masterRaw);
          let legacyKey = null;
          if (auth.wrappedLegacyKey) {
            legacyKey = await this.decryptLegacyKey(
              auth.wrappedLegacyKey,
              key
            );
          }
          return { key, legacyKey, auth };
        } finally {
          clearBytes(masterRaw);
        }
      } catch {
        return null;
      }
    }

    return this.#upgradeLegacyAuth(pin, auth);
  }

  async #upgradeLegacyAuth(pin, auth) {
    if (!auth.salt || !auth.verifier) {
      return null;
    }

    const iterations =
      auth.iterations || LEGACY_PBKDF2_ITERATIONS;
    const legacyMaterial = await derivePinMaterial(
      pin,
      auth.salt,
      iterations
    );
    try {
      const verifier = await makeVerifier(legacyMaterial);
      if (!equalBytes(verifier, auth.verifier)) {
        return null;
      }

      const legacyKey = await importAesKey(legacyMaterial);
      const masterRaw = createMasterMaterial();
      try {
        const wrapper = await wrapMasterWithPin(masterRaw, pin);
        const masterKey = await importAesKey(masterRaw);
        const wrappedLegacyKey = await wrapBytes(
          masterKey,
          legacyMaterial,
          MASTER_KEY_AAD
        );
        return {
          key: masterKey,
          legacyKey,
          auth: {
            key: "auth",
            version: 2,
            ...wrapper,
            wrappedLegacyKey,
          },
          upgradedAuth: true,
        };
      } finally {
        clearBytes(masterRaw);
      }
    } finally {
      clearBytes(legacyMaterial);
    }
  }

  async decryptLegacyKey(wrappedLegacyKey, masterKey) {
    try {
      const material = await unwrapBytes(
        masterKey,
        wrappedLegacyKey,
        MASTER_KEY_AAD
      );
      try {
        return await importAesKey(material);
      } finally {
        clearBytes(material);
      }
    } catch {
      return null;
    }
  }

  /**
   * Replaces only the PIN wrapper. All content ciphertext remains untouched.
   */
  async rewrapMasterKey(oldPin, newPin, auth, destructRecord = null) {
    if (!validCode(oldPin) || !validCode(newPin)) {
      throw new Error("解锁码必须为 4–8 位数字");
    }
    if (!auth || auth.version !== 2 || !auth.wrappedMasterKey) {
      throw new Error("当前设置不支持直接更换解锁码");
    }
    if (
      destructRecord &&
      (await this.verifyDestructRecord(newPin, destructRecord))
    ) {
      throw new Error("新解锁码不能与清除码相同");
    }

    let masterRaw = null;
    try {
      masterRaw = await unwrapMasterWithPin(oldPin, auth);
      const wrapper = await wrapMasterWithPin(masterRaw, newPin);
      const key = await importAesKey(masterRaw);
      return {
        auth: {
          ...auth,
          ...wrapper,
          key: "auth",
          version: 2,
        },
        key,
      };
    } catch {
      throw new Error("原解锁码不正确");
    } finally {
      clearBytes(masterRaw);
    }
  }

  installKey(key) {
    if (!(key instanceof globalThis.CryptoKey)) {
      throw new TypeError("无效的加密密钥");
    }
    this.#masterKey = key;
  }

  lock() {
    this.#masterKey = null;
  }

  async encrypt(data, key = this.#masterKey) {
    if (!key) {
      throw new Error("内容已锁定");
    }

    const iv = randomBytes(12);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return { iv, ciphertext };
  }

  async decrypt(ciphertext, iv, key = this.#masterKey) {
    if (!key) {
      throw new Error("内容已锁定");
    }

    return new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(iv) },
        key,
        ciphertext
      )
    );
  }

  async encryptJson(value, key = this.#masterKey) {
    return this.encrypt(encoder.encode(JSON.stringify(value)), key);
  }

  async decryptJson(ciphertext, iv, key = this.#masterKey) {
    const plain = await this.decrypt(ciphertext, iv, key);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /**
   * Stores only a random salt and a PBKDF2-derived hash. The submitted code is
   * never persisted, and passing the current PIN prevents an accidental
   * overlap between the two entry paths.
   */
  async createDestructRecord(code, currentPin) {
    if (!validCode(code)) {
      throw new Error("清除码必须为 4–8 位数字");
    }
    if (currentPin !== undefined && code === currentPin) {
      throw new Error("清除码不能与解锁码相同");
    }
    const salt = randomBytes(16);
    const hash = await derivePinMaterial(code, salt, PBKDF2_ITERATIONS);
    return {
      key: "destruct",
      version: 1,
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash,
    };
  }

  async verifyDestructRecord(code, record) {
    if (
      !record ||
      record.version !== 1 ||
      !record.salt ||
      !record.hash ||
      !validCode(code)
    ) {
      return false;
    }
    const candidate = await derivePinMaterial(
      code,
      record.salt,
      record.iterations || PBKDF2_ITERATIONS
    );
    try {
      return equalBytes(candidate, record.hash);
    } finally {
      clearBytes(candidate);
    }
  }

  /**
   * Test and migration helper for the former one-layer credential format.
   * New installations never use it.
   */
  async createLegacyCredentials(pin) {
    if (!validCode(pin)) {
      throw new Error("解锁码必须为 4–8 位数字");
    }
    const salt = randomBytes(16);
    const material = await derivePinMaterial(
      pin,
      salt,
      LEGACY_PBKDF2_ITERATIONS
    );
    try {
      const verifier = await makeVerifier(material);
      const key = await importAesKey(material);
      return {
        auth: {
          salt,
          verifier,
          verifierVersion: 1,
        },
        key,
      };
    } finally {
      clearBytes(material);
    }
  }
}
