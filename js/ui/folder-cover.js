export const FOLDER_COVER_LIMIT = 3;

export function pickFolderCoverItems(
  records,
  folderId,
  limit = FOLDER_COVER_LIMIT
) {
  const count = Math.max(0, Math.floor(Number(limit) || 0));
  if (!folderId || count === 0 || !Array.isArray(records)) {
    return [];
  }
  return records
    .filter(
      (record) =>
        record?.folderId === folderId &&
        !record.legacy &&
        ["image", "video"].includes(record.kind)
    )
    .sort(
      (left, right) =>
        (Number(right.updatedAt) || Number(right.createdAt) || 0) -
        (Number(left.updatedAt) || Number(left.createdAt) || 0)
    )
    .slice(0, Math.min(FOLDER_COVER_LIMIT, count));
}
