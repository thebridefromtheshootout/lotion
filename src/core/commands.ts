// ── Command IDs ────────────────────────────────────────────────────
// Central registry of all lotion command IDs. Use these instead of
// hardcoded "lotion.*" strings throughout the codebase.

export const Cmd = {
  // ── Editor ─────────────────────────────────────────────────────────
  smartPaste: "lotion.smartPaste",
  toggleFocusMode: "lotion.toggleFocusMode",
  editFrontmatter: "lotion.editFrontmatter",
  addComment: "lotion.addComment",
  showCommentPanel: "lotion.showCommentPanel",
  resolveComment: "lotion.resolveComment",
  deleteComment: "lotion.deleteComment",
  insertToggleH1: "lotion.insertToggleH1",
  insertToggleH2: "lotion.insertToggleH2",
  insertToggleH3: "lotion.insertToggleH3",
  insertToggle: "lotion.insertToggle",
  insertCallout: "lotion.insertCallout",
  insertCodeBlock: "lotion.insertCodeBlock",
  insertToday: "lotion.insertToday",
  insertDate: "lotion.insertDate",
  insertSection: "lotion.insertSection",
  insertEmoji: "lotion.insertEmoji",
  insertFootnote: "lotion.insertFootnote",
  copyCode: "lotion.copyCode",
  insertTemplate: "lotion.insertTemplate",
  insertToc: "lotion.insertToc",
  insertProcessor: "lotion.insertProcessor",
  refreshProcessors: "lotion.refreshProcessors",
  updateProcessor: "lotion.updateProcessor",
  updateDate: "lotion.updateDate",
  dictate: "lotion.dictate",

  // ── Table ──────────────────────────────────────────────────────────
  insertTable: "lotion.insertTable",
  tableAddRowsBelow: "lotion.tableAddRowsBelow",
  tableAddRowsAbove: "lotion.tableAddRowsAbove",
  tableAddColsRight: "lotion.tableAddColsRight",
  tableAddColsLeft: "lotion.tableAddColsLeft",
  tableDeleteRow: "lotion.tableDeleteRow",
  tableDeleteCol: "lotion.tableDeleteCol",
  tableCopyColumn: "lotion.tableCopyColumn",
  tableCutColumn: "lotion.tableCutColumn",
  tablePasteColumn: "lotion.tablePasteColumn",
  tableTabForward: "lotion.tableTabForward",
  tableTabBackward: "lotion.tableTabBackward",
  tableJumpRowStart: "lotion.tableJumpRowStart",
  tableJumpRowEnd: "lotion.tableJumpRowEnd",
  tableJumpColStart: "lotion.tableJumpColStart",
  tableJumpColEnd: "lotion.tableJumpColEnd",
  tableAlign: "lotion.tableAlign",
  tableSort: "lotion.tableSort",
  tableTranspose: "lotion.tableTranspose",

  // ── Blocks ─────────────────────────────────────────────────────────
  duplicateBlock: "lotion.duplicateBlock",
  selectBlock: "lotion.selectBlock",
  swapBlockUp: "lotion.swapBlockUp",
  swapBlockDown: "lotion.swapBlockDown",
  insertSecretbox: "lotion.insertSecretbox",
  lockBlock: "lotion.lockBlock",
  unlockBlock: "lotion.unlockBlock",
  moveBlock: "lotion.moveBlock",

  // ── Formatting ─────────────────────────────────────────────────────
  toggleBold: "lotion.toggleBold",
  toggleItalic: "lotion.toggleItalic",
  toggleStrikethrough: "lotion.toggleStrikethrough",
  toggleInlineCode: "lotion.toggleInlineCode",
  toggleHighlight: "lotion.toggleHighlight",
  promoteHeading: "lotion.promoteHeading",
  demoteHeading: "lotion.demoteHeading",
  wrapWith: "lotion.wrapWith",

  // ── Links ──────────────────────────────────────────────────────────
  linksToReference: "lotion.linksToReference",
  linksToInline: "lotion.linksToInline",
  insertLink: "lotion.insertLink",
  openLink: "lotion.openLink",
  searchWorkspaceLinks: "lotion.searchWorkspaceLinks",

  // ── Lists ──────────────────────────────────────────────────────────
  listContinue: "lotion.listContinue",
  toggleCheckbox: "lotion.toggleCheckbox",
  indentList: "lotion.indentList",
  outdentList: "lotion.outdentList",
  toggleListType: "lotion.toggleListType",
  renumberList: "lotion.renumberList",
  cleanList: "lotion.cleanList",
  olToUl: "lotion.olToUl",
  ulToOl: "lotion.ulToOl",

  // ── Navigation ─────────────────────────────────────────────────────
  jumpToNextHeading: "lotion.jumpToNextHeading",
  jumpToPrevHeading: "lotion.jumpToPrevHeading",
  jumpToHeading: "lotion.jumpToHeading",
  findOrphanPages: "lotion.findOrphanPages",
  extractToSubpage: "lotion.extractToSubpage",
  showTagIndex: "lotion.showTagIndex",
  recentPages: "lotion.recentPages",
  renamePage: "lotion.renamePage",
  movePage: "lotion.movePage",
  quickSwitch: "lotion.quickSwitch",
  wikiSearch: "lotion.wikiSearch",
  createPage: "lotion.createPage",
  turnInto: "lotion.turnInto",

  // ── Media ──────────────────────────────────────────────────────────
  findUnusedImages: "lotion.findUnusedImages",
  insertImage: "lotion.insertImage",
  insertResource: "lotion.insertResource",
  insertCarousel: "lotion.insertCarousel",
  insertGif: "lotion.insertGif",
  insertGraph: "lotion.insertGraph",
  renderGraph: "lotion.renderGraph",
  exportToPdf: "lotion.exportToPdf",

  // ── Database ───────────────────────────────────────────────────────
  createDatabase: "lotion.createDatabase",
  dbAddEntry: "lotion.dbAddEntry",
  dbNewView: "lotion.dbNewView",
  dbNewField: "lotion.dbNewField",
  dbRenameField: "lotion.dbRenameField",
  dbDeleteField: "lotion.dbDeleteField",
  dbSyncFieldOrder: "lotion.dbSyncFieldOrder",
  dbTableToDatabase: "lotion.dbTableToDatabase",
  dbCsvToDatabase: "lotion.dbCsvToDatabase",
  openDbWebview: "lotion.openDbWebview",
  
  // ── Productivity ───────────────────────────────────────────────────
  fireInto: "lotion.fireInto",

  // ── Views ──────────────────────────────────────────────────────────
  revealHeading: "lotion.revealHeading",
  setPageIcon: "lotion.setPageIcon",
  refreshOutline: "lotion.refreshOutline",
  refreshBacklinks: "lotion.refreshBacklinks",
  focusBacklinks: "lotion.backlinks.focus",

  // ── Productivity ───────────────────────────────────────────────────
  bookmarkPage: "lotion.bookmarkPage",
  removeBookmark: "lotion.removeBookmark",
  openBookmark: "lotion.openBookmark",
  pasteFromHistory: "lotion.pasteFromHistory",
  copyToClipboard: "lotion.copyToClipboard",
  cutToClipboard: "lotion.cutToClipboard",
  openDailyNote: "lotion.openDailyNote",
  pomodoroStart: "lotion.pomodoroStart",
  pomodoroBreak: "lotion.pomodoroBreak",
  pomodoroStop: "lotion.pomodoroStop",
  gitCommit: "lotion.gitCommit",
  expandSnippet: "lotion.expandSnippet",
} as const;

export type CmdId = (typeof Cmd)[keyof typeof Cmd];

// ── Tree View IDs ────────────────────────────────────────────────────
export const TreeView = {
  outline: "lotion.outline",
  backlinks: "lotion.backlinks",
  bookmarks: "lotion.bookmarks",
} as const;

// ── Context Keys ─────────────────────────────────────────────────────
export const Context = {
  cursorInTable: "lotion.cursorInTable",
  cursorOnNonEmptyLine: "lotion.cursorOnNonEmptyLine",
  hasNonEmptySelection: "lotion.hasNonEmptySelection",
} as const;

// ── Webview Panel IDs ────────────────────────────────────────────────
export const Panel = {
  commentPane: "lotion.commentPane",
  dbWebview: "lotion.dbWebview",
  dbView: "lotion.dbView",
  datePicker: "lotion.datePicker",
} as const;
