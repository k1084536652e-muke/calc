/**
 * 文档页富文本：Tiptap 2.x（本地 vendor/tiptap/tiptap.bundle.js，MIT）+ DOMPurify 白名单清洗。
 *
 * - 内容以 HTML 存储（加密写入 IndexedDB），浏览态用同一份 HTML 只读渲染；
 * - 浏览器只渲染「清洗后」的 HTML，避免存储内容里夹带脚本 / 事件属性；
 * - 颜色为 class 型 mark（c-red / c-blue / c-grey / c-orange / c-green），字号为 inline font-size；
 * - 编辑区 `contenteditable`，全局 `user-select:none` 规则对此自动放行（§20）。
 */

import { Editor, StarterKit, Underline, Placeholder, TaskList, TaskItem, Mark, mergeAttributes } from "../../vendor/tiptap/tiptap.bundle.js";
import DOMPurify from "../../vendor/dompurify/purify.es.mjs";

const COLORS = ["", "grey", "red", "orange", "green", "blue"];

/** 文字颜色（class 型 mark，避免 inline style 与 CSP 的摩擦） */
const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => (el.className || "").match(/c-(grey|red|orange|green|blue)/)?.[1] || null,
        renderHTML: (attrs) => (attrs.color ? { class: `c-${attrs.color}` } : {}),
      },
    };
  },
  parseHTML() { return [{ tag: "span[class]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes), 0]; },
});

/** 等宽（class 型 mark） */
const MonoMark = Mark.create({
  name: "mono",
  parseHTML() { return [{ tag: "span.mono" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes({ class: "mono" }, HTMLAttributes), 0]; },
});

/** 字号：唯一使用 inline style 的 mark（17px 为正文基准，与 .note 一致） */
const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => {
          const m = /font-size:\s*(\d+)px/.exec(el.getAttribute("style") || "");
          return m ? Number(m[1]) : null;
        },
        renderHTML: (attrs) => (attrs.size ? { style: `font-size:${attrs.size}px` } : {}),
      },
    };
  },
  parseHTML() { return [{ tag: "span[style]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes), 0]; },
});

const PURIFY = {
  ALLOWED_TAGS: ["h1", "h2", "h3", "p", "br", "ul", "ol", "li", "span", "strong", "b", "em", "i", "u", "s", "strike", "code", "pre", "blockquote", "label", "input", "div"],
  ALLOWED_ATTR: ["class", "style", "data-type", "data-checked", "type", "checked", "disabled"],
};

export function sanitizeDocHTML(html) {
  return DOMPurify.sanitize(String(html || ""), PURIFY);
}

/** 浏览态：把 Tiptap 的清单结构还原成定稿里的静态样式（li.done + span.ckb） */
export function toBrowseHTML(html) {
  const box = document.createElement("div");
  box.innerHTML = sanitizeDocHTML(html);
  box.querySelectorAll('ul[data-type="taskList"]').forEach((ul) => {
    ul.classList.add("checks");
    ul.removeAttribute("data-type");
  });
  box.querySelectorAll("li").forEach((li) => {
    const checked = li.getAttribute("data-checked") === "true";
    const input = li.querySelector('input[type="checkbox"]');
    const label = li.querySelector("label");
    const content = li.querySelector("div");
    if (input || label) {
      li.classList.toggle("done", checked);
      const ck = document.createElement("span");
      ck.className = "ckb";
      if (checked) ck.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
      const holder = document.createElement("span");
      if (content) holder.innerHTML = content.innerHTML;
      li.innerHTML = "";
      li.appendChild(ck);
      li.appendChild(holder);
    }
  });
  return box.innerHTML;
}

export class DocEditor {
  constructor({ bodyEl, onChange }) {
    this.bodyEl = bodyEl;
    this.onChange = onChange || (() => {});
    this.editor = null;
  }

  get isActive() { return !!this.editor; }

  destroy() {
    if (this.editor) { this.editor.destroy(); this.editor = null; }
  }

  /** 挂载编辑器：html 为已解密的存储内容 */
  mount(html) {
    this.destroy();
    this.bodyEl.innerHTML = "";
    this.editor = new Editor({
      element: this.bodyEl,
      injectCSS: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        Underline,
        TaskList,
        TaskItem.configure({ nested: true }),
        TextColor,
        MonoMark,
        FontSize,
        Placeholder.configure({ placeholder: "开始书写…" }),
      ],
      content: sanitizeDocHTML(html || ""),
      onUpdate: () => this.onChange(),
    });
    return this.editor;
  }

  command(fn) {
    if (!this.editor) return;
    fn(this.editor.chain().focus()).run();
  }

  setColor(name) {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    if (!name) chain.unsetMark("textColor").run();
    else chain.setMark("textColor", { color: name }).run();
  }

  toggleMono() {
    if (!this.editor) return;
    this.command((c) => c.toggleMark("mono"));
  }

  /** 字号步进：12–36，作用在选区（无选区时作用于后续输入） */
  stepSize(delta) {
    if (!this.editor) return null;
    const attrs = this.editor.getAttributes("fontSize");
    const cur = Number(attrs.size) || 17;
    const next = Math.min(36, Math.max(12, cur + delta));
    this.editor.chain().focus().setMark("fontSize", { size: next }).run();
    return next;
  }

  getHTML() { return this.editor ? this.editor.getHTML() : ""; }
  getText() { return this.editor ? this.editor.getText() : ""; }
  isEmpty() { return !this.getText().replace(/\s/g, "") && !/<(img|ul|ol)/.test(this.getHTML()); }
}

export { COLORS };
