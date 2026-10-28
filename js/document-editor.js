import {
  Editor,
  Mark,
  Placeholder,
  StarterKit,
  TaskItem,
  TaskList,
  Underline,
  mergeAttributes,
} from "../vendor/tiptap/tiptap.bundle.js";

export const TEXT_COLOR_VALUES = Object.freeze([
  "grey",
  "red",
  "orange",
  "green",
  "blue",
]);
export const FONT_SIZE_VALUES = Object.freeze(
  Array.from({ length: 25 }, (_, index) => index + 12)
);
export const DEFAULT_FONT_SIZE = 17;

function validColor(value) {
  return TEXT_COLOR_VALUES.includes(value) ? value : null;
}

function validFontSize(value) {
  const size = Number(value);
  return FONT_SIZE_VALUES.includes(size) ? size : null;
}

export const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => validColor(element.getAttribute("data-color")),
        renderHTML: (attributes) => {
          const color = validColor(attributes.color);
          return color
            ? {
                "data-color": color,
                class: `c-${color}`,
              }
            : {};
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-color]",
        getAttrs: (element) => {
          const color = validColor(element.getAttribute("data-color"));
          return color ? { color } : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes, mark }) {
    const color = validColor(mark.attrs.color);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-color": color,
        class: color ? `c-${color}` : "",
      }),
      0,
    ];
  },
});

export const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => validFontSize(element.getAttribute("data-size")),
        renderHTML: (attributes) => {
          const size = validFontSize(attributes.size);
          return size
            ? {
                "data-size": String(size),
                class: `fs-${size}`,
              }
            : {};
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-size]",
        getAttrs: (element) => {
          const size = validFontSize(element.getAttribute("data-size"));
          return size ? { size } : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes, mark }) {
    const size = validFontSize(mark.attrs.size);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-size": size ? String(size) : null,
        class: size ? `fs-${size}` : "",
      }),
      0,
    ];
  },
});

export function createDocumentExtensions(onReadOnlyChecked) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      history: { depth: 100 },
    }),
    Underline,
    TaskList,
    TaskItem.configure({
      nested: true,
      onReadOnlyChecked,
      a11y: {
        checkboxLabel: () => "切换清单项",
      },
    }),
    Placeholder.configure({
      placeholder: "开始书写…",
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
    }),
    TextColor,
    FontSize,
  ];
}

export function createDocumentEditor({
  element,
  html,
  editable,
  onUpdate,
  onSelectionUpdate,
  onReadOnlyChecked,
}) {
  return new Editor({
    element,
    extensions: createDocumentExtensions(onReadOnlyChecked),
    content: html,
    editable,
    injectCSS: false,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "note-editor",
        "aria-label": "文档正文",
      },
    },
    onUpdate,
    onSelectionUpdate,
  });
}
