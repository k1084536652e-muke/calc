/** 应用入口：装配数据层（Vault）与媒体缓存（MediaCache），交给 UI 层。 */
import { Vault } from "./core/repo.js";
import { MediaCache } from "./core/media.js";
import * as Stream from "./core/stream.js";
import { initUI, getAutoLockDebug } from "./ui.js";

const vault = new Vault();
const media = new MediaCache(vault);

/* 2.1.2 流式媒体生命周期桥接（只此一处，不改动 UI）：
   解锁后首次播放视频时懒授权把 DEK 交给 SW；锁定 / 页面隐藏 / pagehide 立刻收回，
   并中止在途的 Range 流。详见 js/core/stream.js 与 NOTES-212-streaming.md。 */
Stream.attach({ vault, media });

initUI({ vault, media }).catch((err) => {
  console.error("启动失败", err);
});

/* 便于自动化检查读取状态（只读，不含任何密钥） */
Object.defineProperty(window, "__app", {
  value: {
    get unlocked() { return vault.unlocked; },
    get version() { return document.querySelector('meta[name="build"]')?.content || ""; },
    get autoLock() { return getAutoLockDebug(); },
  },
});
