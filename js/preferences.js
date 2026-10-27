export const PREFERENCES_KEY = "preferences";
export const PREFERENCES_SCHEMA_VERSION = 1;
export const DEFAULT_PREFERENCES = Object.freeze({
  showNames: true,
  trashRetentionDays: 30,
});

function normalizePreferences(value = {}) {
  const requestedRetention = value.trashRetentionDays;
  const trashRetentionDays =
    requestedRetention === null
      ? null
      : [7, 15, 30, 60, 90].includes(Number(requestedRetention))
        ? Number(requestedRetention)
        : DEFAULT_PREFERENCES.trashRetentionDays;
  return {
    showNames:
      typeof value.showNames === "boolean"
        ? value.showNames
        : DEFAULT_PREFERENCES.showNames,
    trashRetentionDays,
  };
}

export async function loadPreferences({ crypto, key, db }) {
  const record = await db.getSetting(PREFERENCES_KEY);
  if (!record?.ciphertext || !record?.iv) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const payload = await crypto.decryptJson(
      record.ciphertext,
      record.iv,
      key
    );
    if (
      payload?.type !== "preferences" ||
      payload.schemaVersion !== PREFERENCES_SCHEMA_VERSION
    ) {
      return { ...DEFAULT_PREFERENCES };
    }
    return normalizePreferences(payload);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences({ crypto, key, db, preferences }) {
  const normalized = normalizePreferences(preferences);
  const encrypted = await crypto.encryptJson(
    {
      type: "preferences",
      schemaVersion: PREFERENCES_SCHEMA_VERSION,
      ...normalized,
    },
    key
  );
  await db.saveSetting({
    key: PREFERENCES_KEY,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  });
  return normalized;
}
