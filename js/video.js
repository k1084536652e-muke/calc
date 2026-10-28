export const PLYR_I18N = Object.freeze({
  restart: "重新播放",
  rewind: "后退 {seektime} 秒",
  play: "播放",
  pause: "暂停",
  fastForward: "快进 {seektime} 秒",
  seek: "跳转",
  seekLabel: "{currentTime} / {duration}",
  played: "已播放",
  buffered: "已缓冲",
  currentTime: "当前时间",
  duration: "时长",
  volume: "音量",
  mute: "静音",
  unmute: "取消静音",
  enterFullscreen: "全屏",
  exitFullscreen: "退出全屏",
  settings: "设置",
  menuBack: "返回上一级",
  speed: "播放速度",
  normal: "正常",
  quality: "画质",
  loop: "循环",
  start: "开始",
  end: "结束",
  all: "全部",
  reset: "重置",
  disabled: "关闭",
  enabled: "开启",
});

export const PLYR_SPEEDS = Object.freeze([
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  2,
]);

export const PLYR_CONTROLS = Object.freeze([
  "play-large",
  "rewind",
  "play",
  "fast-forward",
  "progress",
  "current-time",
  "duration",
  "mute",
  "volume",
  "settings",
  "fullscreen",
]);

export function createPlyrOptions() {
  return {
    controls: [...PLYR_CONTROLS],
    settings: ["speed"],
    speed: {
      selected: 1,
      options: [...PLYR_SPEEDS],
    },
    seekTime: 10,
    invertTime: false,
    toggleInvert: false,
    displayDuration: true,
    hideControls: true,
    resetOnEnd: false,
    storage: { enabled: false },
    fullscreen: {
      enabled: true,
      fallback: true,
      iosNative: true,
    },
    tooltips: {
      controls: false,
      seek: true,
    },
    keyboard: {
      focused: true,
      global: false,
    },
    iconUrl: "vendor/plyr/plyr.svg",
    blankVideo: "vendor/plyr/blank.mp4",
    i18n: { ...PLYR_I18N },
  };
}

export function sideOf(x, rect) {
  const left = Number(rect?.left);
  const width = Number(rect?.width);
  const pointer = Number(x);
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(pointer)
  ) {
    return "";
  }
  const fraction = (pointer - left) / width;
  if (fraction < 0 || fraction > 1) {
    return "";
  }
  return fraction < 1 / 3 ? "l" : fraction > 2 / 3 ? "r" : "";
}
