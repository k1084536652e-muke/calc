export const PREFERENCES_KEY = "preferences";
export const PREFERENCES_SCHEMA_VERSION = 2;
export const ALBUM_THEMES = Object.freeze(["system", "day", "night"]);
export const DEFAULT_PREFERENCES = Object.freeze({
  showNames: true,
  trashRetentionDays: 30,
  albumTheme: "night",
  lastSeenAppVersion: "",
});

function failedPreferences() {
  return {
    ...DEFAULT_PREFERENCES,
    trashRetentionDays: null,
  };
}

function normalizeAlbumTheme(value) {
  return ALBUM_THEMES.includes(value) ? value : "night";
}

function normalizeLastSeenAppVersion(value, schemaVersion) {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 64);
  }
  return schemaVersion === 1 ? "1.9.0" : "";
}

export function normalizePreferences(
  value = {},
  schemaVersion = PREFERENCES_SCHEMA_VERSION
) {
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
    albumTheme: normalizeAlbumTheme(value.albumTheme),
    lastSeenAppVersion: normalizeLastSeenAppVersion(
      value.lastSeenAppVersion,
      schemaVersion
    ),
  };
}

export async function loadPreferences({ crypto, key, db }) {
  const record = await db.getSetting(PREFERENCES_KEY);
  if (!record) {
    return {
      preferences: { ...DEFAULT_PREFERENCES },
      status: "missing",
    };
  }
  if (!record.ciphertext || !record.iv) {
    return {
      preferences: failedPreferences(),
      status: "failed",
    };
  }
  try {
    const payload = await crypto.decryptJson(
      record.ciphertext,
      record.iv,
      key
    );
    if (
      payload?.type !== "preferences" ||
      ![1, PREFERENCES_SCHEMA_VERSION].includes(payload.schemaVersion)
    ) {
      return {
        preferences: failedPreferences(),
        status: "failed",
      };
    }
    return {
      preferences: normalizePreferences(
        payload,
        payload.schemaVersion
      ),
      status: "ok",
    };
  } catch {
    return {
      preferences: failedPreferences(),
      status: "failed",
    };
  }
}

export async function savePreferences({
  crypto,
  key,
  db,
  preferences,
}) {
  const normalized = normalizePreferences(
    preferences,
    PREFERENCES_SCHEMA_VERSION
  );
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

export function shouldShowUpdateToast(
  preferenceState,
  appVersion
) {
  return (
    preferenceState?.status === "ok" &&
    typeof appVersion === "string" &&
    appVersion.length > 0 &&
    preferenceState.preferences?.lastSeenAppVersion !== appVersion
  );
}
