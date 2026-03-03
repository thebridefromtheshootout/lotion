// ── Productivity module barrel ──────────────────────────────────────
export { bookmarkPage, removeBookmark, openBookmark, createBookmarkTreeView } from "./bookmarks";
export { pasteFromHistory, createClipboardHistoryTracker } from "./clipHistory";
export { openDailyNote } from "./dailyNote";
// export { pomodoroStart, pomodoroBreak, pomodoroStop, createPomodoroStatusBar } from "./pomodoro"; // disabled
// export { createTaskProgressStatusBar } from "./taskProgress"; // disabled
export { createStrikethroughDecorations } from "./taskStrikethrough";
export { handleGitCommitCommand } from "./gitCommit";
export { fireInto } from "./fireInto";

