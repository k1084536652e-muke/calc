import { DataCrypto } from "./crypto.js";
import { DataStore } from "./db.js";
import { FinanceCalculator } from "./finance.js";
import { Panel } from "./panel.js";
import {
  beginSystemPanel,
  endSystemPanel,
  getSystemPanelReleaseVersion,
  isSystemPanelActive,
  waitForSystemPanelRelease,
} from "./system-panel.js";
import { closeAllDialogs } from "./dialogs.js";

const panelRoot = document.querySelector("#panel-root");
const cryptoManager = new DataCrypto();
const database = new DataStore();

let authRecord = null;
let destructRecord = null;
let activePanel = null;
let panelOpen = false;
let sessionGeneration = 0;
let setupBusy = false;
let pendingSetupCode = "";
let entryReady = false;
let hiddenPanelReleaseVersion = 0;
let privacyCoverActive = false;
let visibilityEpoch = 0;

const finance = new FinanceCalculator({
  onCode: handleCandidate,
  onModeChange: () => {
    endSystemPanel();
  },
});

function showPrivacyCover() {
  privacyCoverActive = true;
  document.body.classList.add("privacy-cover");
}

function hidePrivacyCover() {
  privacyCoverActive = false;
  document.body.classList.remove("privacy-cover");
}

function lockPanel() {
  sessionGeneration += 1;
  panelOpen = false;
  closeAllDialogs();

  if (activePanel) {
    activePanel.destroy();
    activePanel = null;
  }
  panelRoot.replaceChildren();
  cryptoManager.lock();
  document.body.classList.remove("panel-open");
  document.body.classList.remove("panel-viewer-open");
  hidePrivacyCover();
  finance.clearLoanInput();
  finance.setBusy(false);
  finance.setAuthenticated(Boolean(authRecord));
}

function openPanel(session) {
  cryptoManager.installKey(session.key);
  finance.clearLoanInput();
  finance.setAuthenticated(true);
  panelOpen = true;
  hidePrivacyCover();
  sessionGeneration += 1;
  document.body.classList.add("panel-open");

  activePanel = new Panel({
    host: panelRoot,
    cryptoManager,
    database,
    auth: authRecord,
    legacyKey: session.legacyKey || null,
    onLock: lockPanel,
    onAuthUpdated: (newAuth) => {
      authRecord = newAuth;
      finance.setAuthenticated(true);
    },
    onDestructUpdated: (record) => {
      destructRecord = record;
    },
  });

  void activePanel.mount();
}

async function tryUnlock(candidate) {
  if (!authRecord) {
    return false;
  }

  const attemptGeneration = sessionGeneration;
  const session = await cryptoManager.unlock(candidate, authRecord);
  if (
    !session ||
    attemptGeneration !== sessionGeneration ||
    document.visibilityState === "hidden"
  ) {
    return false;
  }

  if (session.upgradedAuth) {
    await database.replaceAuth(session.auth, authRecord);
    authRecord = session.auth;
  }
  if (attemptGeneration !== sessionGeneration) {
    return false;
  }

  openPanel(session);
  return true;
}

async function handleCandidate(candidate) {
  if (!entryReady) {
    return false;
  }

  if (authRecord) {
    if (
      destructRecord &&
      (await cryptoManager.verifyDestructRecord(candidate, destructRecord))
    ) {
      await clearAllDataSilently();
      return false;
    }
    return tryUnlock(candidate);
  }

  if (setupBusy) {
    return true;
  }

  if (!/^\d{4,8}$/.test(candidate)) {
    return false;
  }

  if (pendingSetupCode === "") {
    pendingSetupCode = candidate;
    finance.clearLoanInput();
    finance.setSetupHint("请再次输入相同数字并计算");
    finance.focusLoanInput();
    return true;
  }

  if (candidate !== pendingSetupCode) {
    pendingSetupCode = "";
    finance.clearLoanInput();
    finance.setSetupHint("两次输入不一致，请重新输入");
    finance.focusLoanInput();
    return true;
  }

  const code = pendingSetupCode;
  setupBusy = true;
  finance.setSetupHint("正在保存本机设置…");

  try {
    const { auth, key } = await cryptoManager.createCredentials(code);
    await database.saveAuth(auth);
    authRecord = auth;
    pendingSetupCode = "";
    finance.setAuthenticated(true);
    openPanel({ key, legacyKey: null, auth });
    return true;
  } catch (error) {
    console.error("首次设置失败", error);
    pendingSetupCode = "";
    finance.clearLoanInput();
    finance.setSetupHint("设置失败，请确认浏览器允许本地存储后重试");
    return true;
  } finally {
    setupBusy = false;
  }
}

async function clearAllDataSilently() {
  authRecord = null;
  destructRecord = null;
  sessionGeneration += 1;
  closeAllDialogs();
  cryptoManager.lock();
  if (activePanel) {
    activePanel.destroy();
    activePanel = null;
  }
  panelRoot.replaceChildren();
  panelOpen = false;
  pendingSetupCode = "";
  setupBusy = false;
  document.body.classList.remove("panel-open");
  document.body.classList.remove("panel-viewer-open");
  hidePrivacyCover();
  navigator.serviceWorker?.controller?.postMessage({
    type: "clear-media-keys",
  });

  try {
    globalThis.localStorage?.clear();
    globalThis.sessionStorage?.clear();
  } catch {
    // Storage can be unavailable in hardened browsing modes.
  }
  if (globalThis.caches?.keys) {
    try {
      const keys = await globalThis.caches.keys();
      await Promise.all(keys.map((key) => globalThis.caches.delete(key)));
    } catch {
      // The database deletion below remains the authoritative wipe.
    }
  }
  try {
    await database.wipe();
  } catch (error) {
    console.error("本地数据清除未完成", error);
  }

  finance.setAuthenticated(false);
  finance.setSetupHint("");
  finance.deferFirstUseHint();
  navigator.serviceWorker?.controller?.postMessage({
    type: "refresh-shell-cache",
  });
}

function handleAutoLock() {
  if (panelOpen) {
    lockPanel();
  }
}

document.addEventListener("visibilitychange", () => {
  const epoch = ++visibilityEpoch;
  if (document.visibilityState === "hidden") {
    if (!panelOpen) {
      return;
    }
    if (isSystemPanelActive()) {
      hiddenPanelReleaseVersion = getSystemPanelReleaseVersion();
      showPrivacyCover();
    } else {
      handleAutoLock();
    }
    return;
  }

  if (!privacyCoverActive || !panelOpen) {
    return;
  }

  void waitForSystemPanelRelease(
    1_500,
    hiddenPanelReleaseVersion
  ).then((released) => {
    if (epoch !== visibilityEpoch || !panelOpen) {
      return;
    }
    if (released) {
      hidePrivacyCover();
    } else {
      lockPanel();
    }
  });
});

window.addEventListener("pagehide", handleAutoLock);
window.addEventListener("blur", () => {
  if (
    panelOpen &&
    document.visibilityState === "visible" &&
    !isSystemPanelActive()
  ) {
    handleAutoLock();
  }
});

async function boot() {
  let storageReady = false;
  try {
    const [savedAuth, savedDestruct] = await Promise.all([
      database.getAuth(),
      database.getSetting("destruct"),
    ]);
    authRecord = savedAuth;
    destructRecord = savedDestruct;
    storageReady = true;
  } catch (error) {
    console.error("读取本地设置失败", error);
  }

  entryReady = storageReady;
  finance.setAuthenticated(Boolean(authRecord));
  finance.setEntryReady(storageReady);
  if (!storageReady) {
    finance.setSetupHint("暂时无法读取本机设置，请刷新页面重试");
  } else if (!authRecord) {
    finance.setSetupHint(
      "首次使用：在贷款金额中输入 4–8 位数字并计算，完成本机偏好设置（建议 6–8 位）"
    );
  } else {
    finance.setSetupHint("");
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (error) {
      console.error("离线缓存初始化失败", error);
    }
  }
}

void boot();
