export const LARGE_EXPORT_BYTES = 1024 * 1024 * 1024;
export const LARGE_EXPORT_CONFIRM_MESSAGE =
  "文件较大，导出可能需要较长时间；若失败请先在电脑上处理或分段导出";
export const SHARE_FAILURE_MESSAGE =
  "无法打开系统分享，导出未完成。请返回列表后重试，或改用下载。";

export function hasLargeExport(records) {
  return records.some(
    (record) =>
      record.kind !== "text" &&
      Number(record.size) > LARGE_EXPORT_BYTES
  );
}

export function isAppleMobile(navigatorLike = globalThis.navigator) {
  if (!navigatorLike) {
    return false;
  }
  const userAgent = String(navigatorLike.userAgent || "");
  const platform = String(navigatorLike.platform || "");
  const touchPoints = Number(navigatorLike.maxTouchPoints) || 0;
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && touchPoints > 1) ||
    /iPad|iPhone|iPod/i.test(platform)
  );
}

export function chooseExportStrategy({
  ios,
  canShareFiles,
  hasLargeStreamingRecord,
}) {
  if (ios) {
    return canShareFiles ? "share" : "ios-download";
  }
  if (hasLargeStreamingRecord) {
    return "stream-download";
  }
  return canShareFiles ? "share" : "stream-download";
}

export function makeFileFromParts(parts, name, type) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("没有可导出的内容");
  }
  return new File(parts, name, { type });
}

export function exportProgressText(written, total) {
  return `正在准备 ${formatTransferSize(written)} / ${formatTransferSize(
    total
  )}`;
}

export function formatTransferSize(size) {
  const bytes = Math.max(0, Number(size) || 0);
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  if (bytes < 1_048_576) {
    return `${(bytes / 1_024).toFixed(1)} KB`;
  }
  if (bytes < 1_073_741_824) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
