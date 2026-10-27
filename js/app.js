import { VaultCrypto } from "./crypto.js";
import { VaultDB } from "./db.js";
import { Calculator } from "./calc.js";
import { Vault } from "./vault.js";
import {
  endSystemPanel,
  isSystemPanelActive,
} from "./system-panel.js";

const calculatorView = document.querySelector("#calculator-view");
const display = document.querySelector("#display");
const expression = document.querySelector("#expression");
const keypad = document.querySelector("#keypad");
const vaultRoot = document.querySelector("#vault-root");

const cryptoManager = new VaultCrypto();
const database = new VaultDB();

let authRecord = null;
let activeVault = null;
let vaultOpen = false;
let sessionGeneration = 0;
let setupBusy = false;
let pendingSetupPin = "";

const calculator = new Calculator({
  display,
  expression,
  keypad,
  calculatorView,
  onSecret: handleSecret,
});

function lockVault() {
  sessionGeneration += 1;
  vaultOpen = false;

  if (activeVault) {
    activeVault.destroy();
    activeVault = null;
  }
  vaultRoot.replaceChildren();
  cryptoManager.lock();
  document.body.classList.remove("vault-open");
  document.body.classList.remove("vault-viewer-open");
  calculator.clear();
  calculator.hasAuth = Boolean(authRecord);

  calculator.setHint("");
}

function openVault(key) {
  cryptoManager.installKey(key);
  calculator.clear();
  calculator.hasAuth = true;
  vaultOpen = true;
  sessionGeneration += 1;
  document.body.classList.add("vault-open");

  activeVault = new Vault({
    host: vaultRoot,
    cryptoManager,
    database,
    auth: authRecord,
    onLock: lockVault,
    onAuthUpdated: (newAuth) => {
      authRecord = newAuth;
      calculator.hasAuth = true;
    },
  });

  void activeVault.mount();
}

async function tryUnlock(candidate) {
  if (!authRecord) {
    return false;
  }

  const attemptGeneration = sessionGeneration;
  const key = await cryptoManager.verifyPin(candidate, authRecord);
  if (
    !key ||
    attemptGeneration !== sessionGeneration ||
    document.visibilityState === "hidden"
  ) {
    return false;
  }

  openVault(key);
  return true;
}

async function handleSecret(candidate) {
  if (authRecord) {
    return tryUnlock(candidate);
  }

  if (setupBusy) {
    return true;
  }

  if (!/^\d{4,8}$/.test(candidate)) {
    calculator.clear();
    calculator.setHint("请输入 4–8 位数字");
    return true;
  }

  if (pendingSetupPin === "") {
    pendingSetupPin = candidate;
    calculator.clear();
    calculator.setHint("请再次输入");
    return true;
  }

  if (candidate !== pendingSetupPin) {
    pendingSetupPin = "";
    calculator.clear();
    calculator.setHint("不一致，请重新输入");
    return true;
  }

  const pin = pendingSetupPin;
  setupBusy = true;
  calculator.setHint("正在设置…");

  try {
    const { auth } = await cryptoManager.derivePin(pin);
    await database.saveAuth(auth);
    authRecord = auth;
    calculator.hasAuth = true;
    pendingSetupPin = "";
    calculator.clear();
    calculator.setHint("");
    return true;
  } catch (error) {
    console.error("首次设置失败", error);
    pendingSetupPin = "";
    calculator.clear();
    calculator.setHint("设置失败，请确认浏览器允许本地存储后重试");
    return true;
  } finally {
    setupBusy = false;
  }
}

function handleAutoLock() {
  if (vaultOpen) {
    lockVault();
  }
}

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "hidden" &&
    !isSystemPanelActive()
  ) {
    handleAutoLock();
  }
});
window.addEventListener("pagehide", handleAutoLock);
window.addEventListener("blur", () => {
  if (!isSystemPanelActive()) {
    handleAutoLock();
  }
});
window.addEventListener("focus", () => {
  endSystemPanel();
});

async function boot() {
  try {
    authRecord = await database.getAuth();
  } catch (error) {
    console.error("读取本地设置失败", error);
  }

  calculator.hasAuth = Boolean(authRecord);
  if (!authRecord) {
    calculator.setHint("首次使用：请输入 4–8 位数字密码后按 =");
  } else {
    calculator.setHint("");
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
