const HTML_ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", "\u00a0"],
  ["quot", '"'],
]);

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function textBodyToHtml(body) {
  const normalized = String(body ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
  if (normalized === "") {
    return "<p></p>";
  }
  return normalized
    .split("\n")
    .map((line) => (line === "" ? "<p><br></p>" : `<p>${escapeHtml(line)}</p>`))
    .join("");
}

export function decodeHtmlEntities(value) {
  return String(value ?? "").replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code) => {
      if (code[0] === "#") {
        const hexadecimal = code[1]?.toLowerCase() === "x";
        const point = Number.parseInt(
          code.slice(hexadecimal ? 2 : 1),
          hexadecimal ? 16 : 10
        );
        if (
          Number.isInteger(point) &&
          point >= 0 &&
          point <= 0x10ffff &&
          !(point >= 0xd800 && point <= 0xdfff)
        ) {
          return String.fromCodePoint(point);
        }
        return "";
      }
      return HTML_ENTITIES.get(code.toLowerCase()) ?? entity;
    }
  );
}

export function htmlToPlainText(html) {
  return decodeHtmlEntities(
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|h[1-6]|li|pre|blockquote)>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function documentCharacterCount(body) {
  return String(body ?? "").replace(/\s/g, "").length;
}

export function textRecordForDisplay(record) {
  const schemaVersion =
    Number(record?.schemaVersion) === 2 ? 2 : 1;
  const body = String(record?.body ?? "");
  if (schemaVersion === 1) {
    return {
      ...record,
      schemaVersion,
      format: "html",
      html: textBodyToHtml(body),
      body,
    };
  }
  return {
    ...record,
    schemaVersion,
    format: "html",
    html: String(record?.html ?? textBodyToHtml(body)),
    body,
  };
}

export function formatDocumentDate(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}年${
    date.getMonth() + 1
  }月${date.getDate()}日 ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}
