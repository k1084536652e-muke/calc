const SYSTEM_PANEL_TIMEOUT_MS = 60_000;

let active = false;
let startedAt = 0;
let timer = 0;
let currentToken = 0;

function clearPanelState() {
  active = false;
  startedAt = 0;
  currentToken = 0;
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
