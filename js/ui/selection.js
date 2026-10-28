const ACTIONS = Object.freeze({
  home: Object.freeze([
    { id: "move", label: "移动", icon: "move" },
    { id: "rename", label: "重命名", icon: "pen" },
    { id: "export", label: "导出", icon: "share" },
    { id: "delete", label: "删除", icon: "trash", danger: true },
  ]),
  folder: Object.freeze([
    { id: "move", label: "移动", icon: "move" },
    { id: "rename", label: "重命名", icon: "pen" },
    { id: "export", label: "导出", icon: "share" },
    { id: "delete", label: "删除", icon: "trash", danger: true },
  ]),
  folders: Object.freeze([
    { id: "rename", label: "重命名", icon: "pen" },
    { id: "delete", label: "删除", icon: "trash", danger: true },
  ]),
  trash: Object.freeze([
    { id: "restore", label: "恢复", icon: "restore" },
    { id: "delete", label: "删除", icon: "trash", danger: true },
  ]),
});

export function selectionContext({ activeTab, currentFolderId }) {
  if (activeTab === "trash") {
    return "trash";
  }
  if (activeTab === "folders") {
    return "folders";
  }
  if (currentFolderId !== null && currentFolderId !== undefined) {
    return "folder";
  }
  return "home";
}

export function selectionActions(context, count) {
  const safeCount = Math.max(0, Number(count) || 0);
  return (ACTIONS[context] || ACTIONS.home).map((action) => ({
    ...action,
    visible: true,
    disabled:
      safeCount === 0 ||
      (action.id === "rename" && safeCount !== 1),
    danger: action.danger === true,
  }));
}
