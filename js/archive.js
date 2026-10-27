export const CHUNK_SIZE = 4 * 1024 * 1024;
export const METADATA_VERSION = 2;

function asUint8(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  return new Uint8Array(value);
}

function abortError() {
  const error = new Error("操作已中断");
  error.name = "AbortError";
  return error;
}

function assertActive(shouldAbort) {
  if (shouldAbort?.()) {
    throw abortError();
  }
}

export async function encryptMetadata(crypto, key, metadata) {
  const encrypted = await crypto.encryptJson(
    {
      ...metadata,
      schemaVersion: METADATA_VERSION,
    },
    key
  );
  return {
    id: metadata.id,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
}

export async function decryptMetadata(crypto, key, envelope) {
  if (!envelope || !envelope.ciphertext || !envelope.iv) {
    throw new Error("不支持的元数据版本");
  }
  const metadata = await crypto.decryptJson(
    envelope.ciphertext,
    envelope.iv,
    key
  );
  if (metadata.id !== envelope.id) {
    throw new Error("元数据标识不一致");
  }
  if (metadata.schemaVersion !== METADATA_VERSION) {
    throw new Error("不支持的元数据版本");
  }
  return metadata;
}

export async function encryptThumbnail(crypto, key, mediaId, blob) {
  if (!blob) {
    return null;
  }
  const plain = new Uint8Array(await blob.arrayBuffer());
  try {
    const encrypted = await crypto.encrypt(plain, key);
    return {
      mediaId,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
    };
  } finally {
    plain.fill(0);
  }
}

export async function decryptThumbnail(crypto, key, envelope) {
  if (!envelope || !envelope.ciphertext || !envelope.iv) {
    return null;
  }
  const plain = await crypto.decrypt(
    envelope.ciphertext,
    envelope.iv,
    key
  );
  return new Blob([plain], { type: "image/jpeg" });
}

/**
 * Encrypts one slice at a time. Only a single 4 MiB plaintext buffer and its
 * ciphertext are live while importing, independent of the source file size.
 */
export async function importFileInChunks({
  file,
  mediaId,
  key,
  crypto,
  db,
  metadata,
  thumbnail,
  onProgress = () => {},
  shouldAbort = () => false,
}) {
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE);
  let written = 0;

  await db.clearChunks(mediaId);
  for (let index = 0; index < chunkCount; index += 1) {
    assertActive(shouldAbort);
    const start = index * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    let plain = new Uint8Array(await file.slice(start, end).arrayBuffer());
    try {
      const encrypted = await crypto.encrypt(plain, key);
      assertActive(shouldAbort);
      await db.putChunk({
        mediaId,
        index,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
      });
      assertActive(shouldAbort);
    } finally {
      plain.fill(0);
      plain = null;
    }

    written = end;
    onProgress({ written, total: file.size, index, chunkCount });
  }

  const completeMetadata = {
    ...metadata,
    id: mediaId,
    type: metadata.type || "media",
    size: file.size,
    chunkSize: CHUNK_SIZE,
    chunkCount,
    folderId: metadata.folderId ?? null,
  };
  assertActive(shouldAbort);
  const metaEnvelope = await encryptMetadata(
    crypto,
    key,
    completeMetadata
  );
  const thumbEnvelope = thumbnail
    ? await encryptThumbnail(crypto, key, mediaId, thumbnail)
    : null;
  await db.saveMedia(metaEnvelope, thumbEnvelope);
  return completeMetadata;
}

/**
 * Decrypts only chunks intersecting [start, end) and returns the exact slice.
 */
export async function readRange({
  db,
  crypto,
  key,
  metadata,
  start = 0,
  end = metadata.size,
}) {
  const size = Number(metadata.size);
  const chunkSize = Number(metadata.chunkSize);
  if (
    !Number.isInteger(size) ||
    !Number.isInteger(chunkSize) ||
    chunkSize <= 0 ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > size
  ) {
    throw new RangeError("读取范围无效");
  }
  if (start === end) {
    return new Uint8Array();
  }

  const first = Math.floor(start / chunkSize);
  const last = Math.floor((end - 1) / chunkSize);
  const indexes = Array.from(
    { length: last - first + 1 },
    (_, offset) => first + offset
  );
  const chunks = await db.getChunks(metadata.id, indexes);
  const parts = [];

  for (let offset = 0; offset < indexes.length; offset += 1) {
    const encrypted = chunks[offset];
    if (!encrypted) {
      throw new Error("缺少内容分块");
    }
    const plain = asUint8(
      await crypto.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        key
      )
    );
    const chunkStart = indexes[offset] * chunkSize;
    const localStart = Math.max(0, start - chunkStart);
    const localEnd = Math.min(plain.length, end - chunkStart);
    if (localEnd > localStart) {
      parts.push(plain.slice(localStart, localEnd));
    }
  }

  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0)
  );
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
}

/**
 * Builds a Blob from one decrypted chunk at a time. This is used by preview
 * and export paths; the list never calls it.
 */
export async function readOriginalBlob({
  db,
  crypto,
  key,
  metadata,
  shouldAbort = () => false,
}) {
  const parts = [];
  for (let index = 0; index < metadata.chunkCount; index += 1) {
    assertActive(shouldAbort);
    const [encrypted] = await db.getChunks(metadata.id, [index]);
    if (!encrypted) {
      throw new Error("缺少内容分块");
    }
    const plain = asUint8(
      await crypto.decrypt(encrypted.ciphertext, encrypted.iv, key)
    );
    try {
      // Blob snapshots the bytes, so the decrypted chunk can be released now.
      parts.push(new Blob([plain]));
    } finally {
      plain.fill(0);
    }
  }
  return new Blob(parts, { type: metadata.mimeType || "application/octet-stream" });
}

/**
 * Converts a former whole-record entry to encrypted metadata, a separately
 * encrypted thumbnail and 4 MiB chunks. The old source is removed only after
 * every new record has been written.
 */
export async function migrateLegacyRecord({
  legacy,
  legacyKey,
  masterKey,
  crypto,
  db,
  onProgress = () => {},
  shouldAbort = () => false,
}) {
  const legacyPlain = asUint8(
    await crypto.decrypt(legacy.ciphertext, legacy.iv, legacyKey)
  );
  let committed = false;
  try {
    assertActive(shouldAbort);
    await db.clearChunks(legacy.id);
    const chunkCount = Math.ceil(legacyPlain.length / CHUNK_SIZE);
    for (let index = 0; index < chunkCount; index += 1) {
      assertActive(shouldAbort);
      const start = index * CHUNK_SIZE;
      const end = Math.min(legacyPlain.length, start + CHUNK_SIZE);
      const plainSlice = legacyPlain.slice(start, end);
      try {
        const encrypted = await crypto.encrypt(plainSlice, masterKey);
        await db.putChunk({
          mediaId: legacy.id,
          index,
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
        });
      } finally {
        plainSlice.fill(0);
      }
      onProgress({ written: end, total: legacyPlain.length });
    }

    let thumbnailEnvelope = null;
    if (legacy.thumbnailCiphertext && legacy.thumbnailIv) {
      const thumbnailPlain = await crypto.decrypt(
        legacy.thumbnailCiphertext,
        legacy.thumbnailIv,
        legacyKey
      );
      const encryptedThumbnail = await crypto.encrypt(
        thumbnailPlain,
        masterKey
      );
      thumbnailEnvelope = {
        mediaId: legacy.id,
        iv: encryptedThumbnail.iv,
        ciphertext: encryptedThumbnail.ciphertext,
      };
    }

    const metadata = {
      id: legacy.id,
      type: "media",
      name: legacy.name || "内容",
      kind: legacy.kind || "image",
      mimeType:
        legacy.mimeType ||
        (legacy.kind === "video" ? "video/mp4" : "image/jpeg"),
      size: legacyPlain.length,
      createdAt: legacy.createdAt || Date.now(),
      folderId: legacy.folderId ?? null,
      chunkSize: CHUNK_SIZE,
      chunkCount,
    };
    const metaEnvelope = await encryptMetadata(
      crypto,
      masterKey,
      metadata
    );
    assertActive(shouldAbort);
    await db.commitMigrated(metaEnvelope, thumbnailEnvelope, legacy.id);
    committed = true;
    return metadata;
  } finally {
    legacyPlain.fill(0);
    if (!committed) {
      await db.clearChunks(legacy.id).catch(() => {});
    }
  }
}
