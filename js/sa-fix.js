/* iOS 主屏 App 全屏修复（DESIGN-NOTES §23，定案版）。
   WebKit 在 standalone + viewport-fit=cover + black-translucent 下会把布局视口报短
   （innerHeight / 100% / 100dvh / position:fixed 的 bottom:0 都按它算），导致底部一条没人绘制。
   做法：只在 standalone 时给 <html> 加 .standalone / .sa-fix，整屏层改用显式高度 --app-h。
   顶栏内容下移 20px（--top-extra）由 CSS 的 html.standalone 规则给出，这里只算高度。
   Safari 标签页中不加任何类，行为与定稿完全一致。 */
(function () {
  var d = document.documentElement;
  var q = location.search;
  /* ?sa=1 / ?safe=59,34 仅用于自动化检查时模拟主屏 App；正常使用不会触发。 */
  var sa = navigator.standalone === true
    || matchMedia("(display-mode: standalone)").matches
    || matchMedia("(display-mode: fullscreen)").matches
    || /[?&]sa=1/.test(q);
  var ios = /iP(hone|od|ad)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    || /[?&]sa=1/.test(q);

  try {
    var m = /[?&]safe=(\d+),(\d+)/.exec(q);
    if (m) { d.style.setProperty("--safe-top", m[1] + "px"); d.style.setProperty("--safe-bottom", m[2] + "px"); }
  } catch (e) { /* ignore */ }

  if (!sa) return;
  d.classList.add("standalone", "sa-fix");

  function apply() {
    var land = matchMedia("(orientation: landscape)").matches;
    var scr = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    var vv = window.visualViewport ? visualViewport.height : 0;
    var h = Math.max(innerHeight, vv, d.clientHeight || 0);
    if (ios && scr > h && scr - h <= 140) h = scr;
    d.style.setProperty("--app-h", Math.round(h) + "px");
  }
  apply();
  ["resize", "orientationchange", "pageshow"].forEach(function (ev) {
    addEventListener(ev, function () { apply(); setTimeout(apply, 300); });
  });
  if (window.visualViewport) visualViewport.addEventListener("resize", apply);
})();
