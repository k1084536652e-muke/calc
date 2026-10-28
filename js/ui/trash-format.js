import { trashRemainingDays } from "../trash.js";

export function trashRemainingLabel({
  item,
  retentionDays,
  preferencesUnavailable = false,
  now = Date.now(),
}) {
  if (preferencesUnavailable) {
    return "自动清理已暂停";
  }
  if (retentionDays === null) {
    return "不会自动删除";
  }
  const remaining = trashRemainingDays(item, retentionDays, now);
  if (remaining === null) {
    return "不会自动删除";
  }
  return `${Math.max(0, remaining)} 天后删除`;
}
