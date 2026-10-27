export function bindBackgroundLockListeners({
  documentTarget,
  windowTarget,
  isPanelOpen,
  isDocumentHidden,
  isSystemPanelActive,
  getSystemPanelReleaseVersion,
  showPrivacyCover,
  hidePrivacyCover,
  waitForSystemPanelRelease,
  lockPanel,
  onVisible,
}) {
  let visibilityEpoch = 0;
  let hiddenPanelReleaseVersion = 0;
  let privacyCoverActive = false;

  const lock = () => {
    privacyCoverActive = false;
    lockPanel();
  };

  const handleAutoLock = () => {
    if (isPanelOpen()) {
      lock();
    }
  };

  const handleVisibilityChange = () => {
    const epoch = ++visibilityEpoch;
    if (isDocumentHidden()) {
      if (!isPanelOpen()) {
        return;
      }
      if (isSystemPanelActive()) {
        hiddenPanelReleaseVersion = getSystemPanelReleaseVersion();
        privacyCoverActive = true;
        showPrivacyCover();
      } else {
        lock();
      }
      return;
    }

    if (!isPanelOpen()) {
      onVisible?.();
    }
    if (!privacyCoverActive || !isPanelOpen()) {
      return;
    }

    void waitForSystemPanelRelease(
      1_500,
      hiddenPanelReleaseVersion
    ).then((released) => {
      if (epoch !== visibilityEpoch) {
        return;
      }
      if (!isPanelOpen()) {
        privacyCoverActive = false;
        hidePrivacyCover();
        return;
      }
      privacyCoverActive = false;
      if (released) {
        hidePrivacyCover();
      } else {
        lock();
      }
    });
  };

  documentTarget.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );
  windowTarget.addEventListener("pagehide", handleAutoLock);

  return {
    destroy() {
      documentTarget.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      windowTarget.removeEventListener("pagehide", handleAutoLock);
    },
  };
}
