export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_TOLERANCE = 10;
export const LONG_PRESS_CLICK_GUARD_MS = 700;

export class LongPressController {
  constructor({
    delay = LONG_PRESS_MS,
    moveTolerance = LONG_PRESS_MOVE_TOLERANCE,
    clickGuardMs = LONG_PRESS_CLICK_GUARD_MS,
    onTrigger = () => {},
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = (handle) => clearTimeout(handle),
    now = () => Date.now(),
  } = {}) {
    this.delay = delay;
    this.moveTolerance = moveTolerance;
    this.clickGuardMs = clickGuardMs;
    this.onTrigger = onTrigger;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.now = now;
    this.timer = 0;
    this.pending = null;
    this.suppressUntil = 0;
  }

  begin({ key, x, y }) {
    this.suppressUntil = 0;
    this.cancel();
    if (key === null || key === undefined || key === "") {
      return false;
    }
    this.pending = { key, x, y };
    this.timer = this.setTimer(() => {
      const pending = this.pending;
      this.timer = 0;
      this.pending = null;
      if (!pending) {
        return;
      }
      this.suppressUntil = this.now() + this.clickGuardMs;
      this.onTrigger(pending.key);
    }, this.delay);
    return true;
  }

  move(x, y) {
    if (
      this.pending &&
      Math.hypot(x - this.pending.x, y - this.pending.y) >
        this.moveTolerance
    ) {
      this.cancel();
      return true;
    }
    return false;
  }

  end() {
    this.cancel();
  }

  cancel() {
    if (this.timer) {
      this.clearTimer(this.timer);
    }
    this.timer = 0;
    this.pending = null;
  }

  shouldSuppressClick() {
    if (this.now() > this.suppressUntil) {
      this.suppressUntil = 0;
      return false;
    }
    const suppress = this.suppressUntil > 0;
    if (suppress) {
      this.suppressUntil = 0;
    }
    return suppress;
  }

  destroy() {
    this.cancel();
    this.suppressUntil = 0;
  }
}
