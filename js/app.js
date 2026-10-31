/** 应用入口：装配数据层（Vault）与媒体缓存（MediaCache），交给 UI 层。 */
import { Vault } from "./core/repo.js";
import { MediaCache } from "./core/media.js";
import { initUI } from "./ui.js";

const vault = new Vault();
const media = new MediaCache(vault);

initUI({ vault, media }).catch((err) => {
  console.error("启动失败", err);
});

/* 自动化检查钩子：仅在 ?debug=1 时暴露仓储对象（不含密钥材料，仍只在内存里） */
if (/[?&]debug=1/.test(location.search)) {
  Object.defineProperty(window, "__vault", { value: vault });
  Object.defineProperty(window, "__media", { value: media });
}

/* 便于自动化检查读取状态（只读，不含任何密钥） */
Object.defineProperty(window, "__app", {
  value: {
    get unlocked() { return vault.unlocked; },
    get version() { return document.querySelector('meta[name="build"]')?.content || ""; },
  },
});
