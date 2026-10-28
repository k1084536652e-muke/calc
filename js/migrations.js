import {
  APP_VERSION,
  DATA_SCHEMA_VERSION,
} from "./version-info.js";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  loadPreferences,
  normalizePreferences,
  savePreferences,
} from "./preferences.js";

export const DATA_SCHEMA_KEY = "dataSchema";

export async function readDataSchemaVersion({ db }) {
  const record = await db.getSetting(DATA_SCHEMA_KEY);
  if (!record) {
    return 1;
  }
  const version = Number(record.version);
  return Number.isInteger(version) && version >= 1 ? version : 1;
}

export async function saveDataSchemaVersion({ db, version }) {
  if (!Number.isInteger(version) || version < 1) {
    throw new RangeError("数据架构版本无效");
  }
  await db.saveSetting({
    key: DATA_SCHEMA_KEY,
    version,
  });
}

export async function migratePreferencesToV2({
  db,
  crypto,
  key,
}) {
  const state = await loadPreferences({ crypto, key, db });
  if (state.status === "failed") {
    return false;
  }
  const preferences =
    state.status === "ok"
      ? state.preferences
      : { ...DEFAULT_PREFERENCES };
  await savePreferences({
    crypto,
    key,
    db,
    preferences: {
      ...normalizePreferences(
        preferences,
        PREFERENCES_SCHEMA_VERSION
      ),
      albumTheme: preferences.albumTheme || "night",
      lastSeenAppVersion:
        preferences.lastSeenAppVersion || "1.9.0",
    },
  });
  return true;
}

export async function runMigrations({
  db,
  crypto,
  key,
  from,
  to = DATA_SCHEMA_VERSION,
}) {
  let currentVersion = Number.isInteger(from)
    ? from
    : await readDataSchemaVersion({ db });
  const targetVersion = Number.isInteger(to)
    ? to
    : DATA_SCHEMA_VERSION;

  if (
    !Number.isInteger(currentVersion) ||
    currentVersion < 1 ||
    !Number.isInteger(targetVersion) ||
    targetVersion < 1
  ) {
    const error = new Error("数据架构版本无效");
    console.error("数据升级失败", error);
    return {
      status: "failed",
      fromVersion: currentVersion,
      toVersion: targetVersion,
      error,
    };
  }

  if (currentVersion > targetVersion) {
    console.warn(
      `本机数据架构版本 ${currentVersion} 高于当前应用支持的 ${targetVersion}，不执行降级`
    );
    return {
      status: "newer",
      fromVersion: currentVersion,
      toVersion: targetVersion,
    };
  }

  try {
    while (currentVersion < targetVersion) {
      if (currentVersion === 1 && targetVersion >= 2) {
        const migrated = await migratePreferencesToV2({
          db,
          crypto,
          key,
        });
        if (!migrated) {
          const error = new Error(
            "偏好暂不可解密，保留旧数据以便重试"
          );
          console.error("数据升级失败", error);
          return {
            status: "failed",
            fromVersion: currentVersion,
            toVersion: targetVersion,
            error,
          };
        }
        await saveDataSchemaVersion({
          db,
          version: 2,
        });
        currentVersion = 2;
        continue;
      }
      throw new Error(`不存在 ${currentVersion} 到 ${targetVersion} 的迁移`);
    }
  } catch (error) {
    console.error("数据升级失败", error);
    return {
      status: "failed",
      fromVersion: currentVersion,
      toVersion: targetVersion,
      error,
    };
  }

  return {
    status:
      currentVersion === targetVersion ? "complete" : "up-to-date",
    fromVersion: currentVersion,
    toVersion: targetVersion,
  };
}

export async function initializeNewUserData({
  db,
  crypto,
  key,
  appVersion = APP_VERSION,
}) {
  await savePreferences({
    crypto,
    key,
    db,
    preferences: {
      ...DEFAULT_PREFERENCES,
      albumTheme: "night",
      lastSeenAppVersion: appVersion,
    },
  });
  await saveDataSchemaVersion({
    db,
    version: DATA_SCHEMA_VERSION,
  });
}
