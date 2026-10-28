export function normalizeQuery(query) {
  return String(query ?? "").trim().toLocaleLowerCase("zh-CN");
}

export function matchQuery(name, query) {
  const needle = normalizeQuery(query);
  if (!needle) {
    return true;
  }
  return String(name ?? "")
    .toLocaleLowerCase("zh-CN")
    .includes(needle);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]
  );
}

/**
 * Splits a display name into safe text and highlighted text segments.
 * Consumers should write `text` with textContent; `html` is pre-escaped for
 * callers that already build trusted markup.
 */
export function highlightParts(name, query) {
  const source = String(name ?? "");
  const needle = normalizeQuery(query);
  if (!needle) {
    return [{ text: source, matched: false, html: escapeHtml(source) }];
  }

  const haystack = source.toLocaleLowerCase("zh-CN");
  const parts = [];
  let cursor = 0;
  let matchIndex = haystack.indexOf(needle);
  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      const text = source.slice(cursor, matchIndex);
      parts.push({ text, matched: false, html: escapeHtml(text) });
    }
    const text = source.slice(matchIndex, matchIndex + needle.length);
    parts.push({
      text,
      matched: true,
      html: `<mark class="hl">${escapeHtml(text)}</mark>`,
    });
    cursor = matchIndex + needle.length;
    matchIndex = haystack.indexOf(needle, cursor);
  }
  if (cursor < source.length) {
    const text = source.slice(cursor);
    parts.push({ text, matched: false, html: escapeHtml(text) });
  }
  return parts.length > 0
    ? parts
    : [{ text: source, matched: false, html: escapeHtml(source) }];
}

function itemName(item) {
  return item.name || item.title || item.displayName || "无标题";
}

function itemCategory(item) {
  if (item.category) {
    return item.category;
  }
  if (item.kind === "folder" || item.trashType === "folder") {
    return "folder";
  }
  if (item.kind === "image") {
    return "image";
  }
  if (item.kind === "video") {
    return "video";
  }
  return "document";
}

/**
 * Filters an in-memory metadata index. `folderId: undefined` searches the
 * current page's complete scope; pass `null` to restrict to uncategorized
 * items and a string to restrict to one folder.
 */
export function filterItems(
  items,
  {
    q = "",
    filter = "all",
    folderId,
    getName = itemName,
    getCategory = itemCategory,
    getSearchText = (item) => item.searchText,
  } = {}
) {
  const query = normalizeQuery(q);
  const validFilter = [
    "all",
    "image",
    "video",
    "document",
    "folder",
  ].includes(filter)
    ? filter
    : "all";
  return items.filter((item) => {
    if (
      folderId !== undefined &&
      (item.folderId ?? null) !== folderId
    ) {
      return false;
    }
    const category = getCategory(item);
    if (validFilter === "folder") {
      if (category !== "folder") {
        return false;
      }
    } else if (
      validFilter !== "all" &&
      category !== validFilter
    ) {
      return false;
    }
    if (!query) {
      return true;
    }
    const searchText =
      getSearchText(item) ??
      `${itemName(item)}\n${item.title || ""}\n${item.body || ""}`;
    return normalizeQuery(searchText).includes(query);
  });
}
