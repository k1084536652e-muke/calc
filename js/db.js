const DB_NAME = "calc-data";
const LEGACY_DB_NAME = "calculator-private-vault";
const DB_VERSION = 1;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener("error", () => reject(request.error), {
      once: true,
    });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "error",
      () => reject(transaction.error || new Error("数据库事务失败")),
      { once: true }
    );
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error || new Error("数据库事务已取消")),
      { once: true }
    );
  });
}

function openDatabase(name, version, onCreate) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.addEventListener("upgradeneeded", () => {
      if (onCreate) {
        onCreate(request.result);
      }
    });
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => database.close());
      resolve(database);
    });
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      reject(new Error("数据库被另一个页面占用，请关闭后重试"));
    });
  });
}

function deleteDatabase(name, rejectIfBlocked = false) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error || new Error("删除数据库失败")),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => {
        if (rejectIfBlocked) {
          reject(new Error("数据库仍被占用，请关闭其他应用窗口后重试"));
        } else {
          resolve();
        }
      },
      { once: true }
    );
  });
}

async function readLegacyData() {
  const database = await openDatabase(LEGACY_DB_NAME);
  const storeNames = Array.from(database.objectStoreNames);
  if (!storeNames.includes("settings") || !storeNames.includes("media")) {
    database.close();
    await deleteDatabase(LEGACY_DB_NAME);
    return null;
  }

  try {
    const transaction = database.transaction(storeNames, "readonly");
    const authRequest = transaction.objectStore("settings").get("auth");
    const mediaRequest = transaction.objectStore("media").getAll();
    const [auth, media] = await Promise.all([
      requestResult(authRequest),
      requestResult(mediaRequest),
    ]);
    await transactionDone(transaction);
    return { auth, media };
  } finally {
    database.close();
  }
}

async function databaseHasData(database) {
  const transaction = database.transaction(["settings", "media"], "readonly");
  const authRequest = transaction.objectStore("settings").get("auth");
  const mediaCountRequest = transaction.objectStore("media").count();
  const [auth, mediaCount] = await Promise.all([
    requestResult(authRequest),
    requestResult(mediaCountRequest),
  ]);
  await transactionDone(transaction);
  return Boolean(auth) || mediaCount > 0;
}

async function migrateLegacyData(database) {
  if (await databaseHasData(database)) {
    return;
  }

  const legacy = await readLegacyData();
  if (!legacy || (!legacy.auth && legacy.media.length === 0)) {
    return;
  }

  const transaction = database.transaction(
    ["settings", "media"],
    "readwrite"
  );
  const settings = transaction.objectStore("settings");
  const media = transaction.objectStore("media");
  if (legacy.auth) {
    settings.put(legacy.auth);
  }
  for (const record of legacy.media) {
    media.put(record);
  }
  await transactionDone(transaction);
  await deleteDatabase(LEGACY_DB_NAME);
}

export class VaultDB {
  #databasePromise = null;

  open() {
    if (this.#databasePromise) {
      return this.#databasePromise;
    }

    this.#databasePromise = new Promise((resolve, reject) => {
      void openDatabase(DB_NAME, DB_VERSION, (database) => {
        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings", { keyPath: "key" });
        }
        if (!database.objectStoreNames.contains("media")) {
          const media = database.createObjectStore("media", {
            keyPath: "id",
          });
          media.createIndex("createdAt", "createdAt");
        }
      })
        .then(async (database) => {
          try {
            await migrateLegacyData(database);
          } catch (error) {
            console.error("旧数据库迁移失败", error);
          }
          resolve(database);
        })
        .catch(reject);
    });

    return this.#databasePromise;
  }

  async getAuth() {
    const database = await this.open();
    const transaction = database.transaction("settings", "readonly");
    const record = await requestResult(
      transaction.objectStore("settings").get("auth")
    );
    await transactionDone(transaction);

    if (!record) {
      return null;
    }
    return {
      salt: record.salt,
      verifier: record.verifier,
    };
  }

  async saveAuth(auth) {
    const database = await this.open();
    const transaction = database.transaction("settings", "readwrite");
    transaction.objectStore("settings").put({
      key: "auth",
      salt: auth.salt,
      verifier: auth.verifier,
    });
    await transactionDone(transaction);
  }

  async addMedia(record) {
    const database = await this.open();
    const transaction = database.transaction("media", "readwrite");
    transaction.objectStore("media").put(record);
    await transactionDone(transaction);
  }

  async getAllMedia() {
    const database = await this.open();
    const transaction = database.transaction("media", "readonly");
    const records = await requestResult(
      transaction.objectStore("media").getAll()
    );
    await transactionDone(transaction);
    return records.sort((left, right) => right.createdAt - left.createdAt);
  }

  async deleteMedia(id) {
    const database = await this.open();
    const transaction = database.transaction("media", "readwrite");
    transaction.objectStore("media").delete(id);
    await transactionDone(transaction);
  }

  async replaceAuthAndMedia(auth, records) {
    const database = await this.open();
    const transaction = database.transaction(
      ["settings", "media"],
      "readwrite"
    );
    const settings = transaction.objectStore("settings");
    const media = transaction.objectStore("media");

    settings.put({
      key: "auth",
      salt: auth.salt,
      verifier: auth.verifier,
    });
    media.clear();
    for (const record of records) {
      media.put(record);
    }

    await transactionDone(transaction);
  }

  async wipe() {
    const database = await this.open();
    database.close();
    this.#databasePromise = null;
    await deleteDatabase(DB_NAME, true);
    await deleteDatabase(LEGACY_DB_NAME, true);
  }
}
