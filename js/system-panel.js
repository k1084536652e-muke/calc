const SYSTEM_PANEL_TIMEOUT_MS = 60_000;

let active = false;
let startedAt = 0;
let timer = 0;
let currentToken = 0;
let releaseVersion = 0;
const releaseWaiters = new Set();

function notifyReleased() {
  releaseVersion += 1;
  for (const waiter of [...releaseWaiters]) {
    waiter.resolve(true);
  }
}

function clearPanelState() {
  active = false;
  startedAt = 0;
  globalThis.clearTimeout(timer);
  timer = 0;
}

export function beginSystemPanel() {
  clearPanelState();
  active = true;
  startedAt = Date.now();
  currentToken += 1;
  const token = currentToken;
  timer = globalThis.setTimeout(() => {
    if (token === currentToken) {
      clearPanelState();
    }
  }, SYSTEM_PANEL_TIMEOUT_MS);
  return token;
}

export function endSystemPanel(token) {
  if (token === undefined || token === currentToken) {
    clearPanelState();
    notifyReleased();
  }
}

export function isSystemPanelActive() {
  if (!active) {
    return false;
  }
  if (Date.now() - startedAt >= SYSTEM_PANEL_TIMEOUT_MS) {
    clearPanelState();
    return false;
  }
  return true;
}

export function getSystemPanelReleaseVersion() {
  return releaseVersion;
}

export function waitForSystemPanelRelease(
  timeoutMs = 1_500,
  releasedAfterVersion = releaseVersion
) {
  if (releaseVersion > releasedAfterVersion) {
    return Promise.resolve(true);
  }
  if (!isSystemPanelActive()) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const waiter = {
      resolve(value) {
        globalThis.clearTimeout(waiter.timer);
        releaseWaiters.delete(waiter);
        resolve(value);
      },
      timer: 0,
    };
    releaseWaiters.add(waiter);
    waiter.timer = globalThis.setTimeout(() => {
      waiter.resolve(false);
    }, Math.max(0, timeoutMs));
  });
}
