import createDOMPurify from "../vendor/dompurify/purify.es.mjs";

export const ALLOWED_HTML_TAGS = Object.freeze([
  "p",
  "br",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "span",
  "label",
  "input",
  "div",
]);

export const ALLOWED_HTML_ATTRIBUTES = Object.freeze([
  "class",
  "data-type",
  "data-checked",
  "data-color",
  "data-size",
  "type",
  "checked",
]);

const COLOR_CLASS = /^c-(?:grey|red|orange|green|blue)$/;
const SIZE_CLASS = /^fs-(?:1[2-9]|2\d|3[0-6])$/;

export function filterDocumentClass(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter((name) => COLOR_CLASS.test(name) || SIZE_CLASS.test(name))
    .join(" ");
}

export function createDocumentSanitizer(windowObject = globalThis.window) {
  const purifier =
    typeof createDOMPurify.sanitize === "function"
      ? createDOMPurify
      : createDOMPurify(windowObject);
  if (!purifier?.isSupported) {
    throw new Error("当前环境无法清洗富文本");
  }

  purifier.addHook("uponSanitizeElement", (node) => {
    if (
      node?.nodeName?.toLowerCase() === "input" &&
      node.getAttribute("type")?.toLowerCase() !== "checkbox"
    ) {
      node.parentNode?.removeChild(node);
    }
  });
  purifier.addHook("afterSanitizeAttributes", (node) => {
    if (!node?.hasAttribute?.("class")) {
      return;
    }
    const keep = filterDocumentClass(node.getAttribute("class"));
    if (keep) {
      node.setAttribute("class", keep);
    } else {
      node.removeAttribute("class");
    }
  });

  return {
    sanitize(html) {
      return purifier.sanitize(String(html ?? ""), {
        ALLOWED_TAGS: ALLOWED_HTML_TAGS,
        ALLOWED_ATTR: ALLOWED_HTML_ATTRIBUTES,
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        FORBID_ATTR: ["style", "href", "src"],
        FORBID_TAGS: ["script", "style", "img", "iframe", "object", "embed"],
        KEEP_CONTENT: true,
        RETURN_TRUSTED_TYPE: false,
      });
    },
  };
}

let browserSanitizer = null;

export function sanitizeHtml(html) {
  browserSanitizer ||= createDocumentSanitizer(globalThis.window);
  return browserSanitizer.sanitize(html);
}
