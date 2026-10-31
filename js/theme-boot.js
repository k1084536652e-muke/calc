/* 尽早应用主题，避免闪烁（§2 / §22）。
   打开时总是计算器页 → 读明文键 calc-theme（night / day / system）；相册主题是独立键 album-theme，
   旧版只有 calc-theme 时先迁移为两者相同。此脚本必须同步执行、位于样式表之前。 */
(function () {
  try {
    var c = localStorage.getItem("calc-theme");
    if (c && !localStorage.getItem("album-theme")) localStorage.setItem("album-theme", c);
    var p = c || "night";
    var t = p === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day") : p;
    document.documentElement.setAttribute("data-theme", t === "day" ? "day" : "night");
  } catch (e) { /* 隐私模式下 localStorage 可能不可用 */ }
})();
