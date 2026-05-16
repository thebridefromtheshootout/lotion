import { hostEditor } from "./hostEditor/HostingEditor";
import { Position, Uri } from "./hostEditor/EditorTypes";
import type { ExtensionContext } from "./hostEditor/EditorTypes";
// ── Module barrels ──────────────────────────────────────────────────
import {
  updateCwd,
  createSlashCompletionProvider,
  createStructureLinter,
  initBlockIndex,
  initWebviewShell,
  SLASH_COMMANDS,
  Cmd,
  TreeView,
  Context,
  createCodeLensProvider,
  CODELENS_GENERATORS,
  SIMPLE_COMMANDS,
  INLINE_FORMATS,
  slashHandler,
  parseCommandArgs,
  createFileHashTracker,
} from "./core";

import {
  handleUpdateDate,
  tableKeybindingCommands,
  cursorInTable,
  createTocAutoUpdater,
  createTableAlignOnSave,
  resolveComment,
  deleteComment,
  createCommentCodeLensProvider,
  createEditorDecorations,
} from "./editor";

import { createSecretboxGuard, createSecretboxSaveGuard } from "./blocks";

import { toggleWrap, createHeadingColors, createSmartTypography, createAutoInlineCode, createLinkFactory } from "./formatting";

import {
  createBacklinkCodeLensProvider,
  BacklinksProvider,
  createLinkCompletionProvider,
  createLinkHoverProvider,
  createLinkValidator,
} from "./links";

import { createListRenumber, createListSwapMarker, createListMarkerColors } from "./lists";

import { createRecentPagesTracker } from "./navigation";

import {
  refreshAllDbWebviews,
  handleDbEntryCommand,
  openDbWebview,
  findParentDbIndex,
  isDbFile,
  invalidateDbFileCache,
} from "./database";

import { createImageDropProvider, createImagePasteProvider, createImageHoverProvider } from "./media";

import {
  HeadingOutlineProvider,
  createPageIconProvider,
  createReadingProgress,
  createWordCountStatusBar,
} from "./views";

import {
  createBookmarkTreeView,
  createStrikethroughDecorations,
  createLineLock,
} from "./productivity";

// ── Extension activation ───────────────────────────────────────────
export function activate(context: ExtensionContext) {
  hostEditor.init(context);
  initWebviewShell(context.extensionUri);
  // Initialise cwd from current editor
  updateCwd();
  hostEditor.onDidChangeActiveTextEditor(() => updateCwd());

  // ── File hash tracker (for slash-command dirty-state detection) ────
  context.subscriptions.push(createFileHashTracker());

  // ── Per-document block index (cached, throttled rebuild on text change) ──
  context.subscriptions.push(initBlockIndex());


  const updateCursorContext = () => {
    if (!hostEditor.isMarkdownEditor()) {
      hostEditor.executeCommand("setContext", Context.cursorInTable, false);
      hostEditor.executeCommand("setContext", Context.cursorOnNonEmptyLine, false);
      hostEditor.executeCommand("setContext", Context.hasNonEmptySelection, false);
      return;
    }
    const doc = hostEditor.getDocument();
    const pos = hostEditor.getCursorPosition()!;
    const inTable = doc ? cursorInTable(doc, pos) : false;
    hostEditor.executeCommand("setContext", Context.cursorInTable, inTable);
    const lineText = doc?.lineAt(pos.line).text ?? "";
    hostEditor.executeCommand("setContext", Context.cursorOnNonEmptyLine, lineText.length > 0);
    const hasNonEmptySelection = hostEditor.getSelections().some(s => !s.isEmpty);
    hostEditor.executeCommand("setContext", Context.hasNonEmptySelection, hasNonEmptySelection);
  };
  updateCursorContext();
  hostEditor.onDidChangeActiveTextEditor(updateCursorContext);
  hostEditor.onDidChangeTextEditorSelection(() => updateCursorContext());

  // ── Slash-command handlers (docUri, line, character) ────────────
  // Register all slash commands with handlers from the master SLASH_COMMANDS array
  // (openDbWebview is excluded — it has custom arg handling below)
  for (const cmd of SLASH_COMMANDS.filter((c) => c.handler && c.commandId && c.commandId !== Cmd.openDbWebview)) {
    context.subscriptions.push(hostEditor.registerCommand(cmd.commandId!, slashHandler(cmd.handler!, cmd.cleanLine)));
  }

  // openDbWebview — called from CodeLens with a direct path, or from slash command with (docUri, line, char)
  const resolveDbIndex = (fsPath: string): string | undefined =>
    isDbFile(fsPath) ? fsPath : findParentDbIndex(fsPath);

  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.openDbWebview, async (...args: any[]) => {
      const parsed = parseCommandArgs(args);
      let fsPath: string | undefined;

      if (parsed.kind === "fsPath") {
        // Called from CodeLens — direct fsPath to the database index.md
        fsPath = parsed.fsPath;
      } else if (parsed.kind === "slash") {
        const doc = await hostEditor.openTextDocument(Uri.parse(parsed.docUri));
        fsPath = doc.uri.fsPath;
      } else {
        // Called from command palette — use active editor
        const doc = hostEditor.getDocument();
        if (!doc) {
          hostEditor.showWarning("Lotion: No active editor. Open a database file first.");
          return;
        }
        fsPath = doc.uri.fsPath;
      }

      const dbIndexPath = resolveDbIndex(fsPath);
      if (!dbIndexPath) {
        hostEditor.showWarning("Lotion: This file is not part of a database.");
        return;
      }
      await openDbWebview(dbIndexPath);
    }),
  );

  // ── Simple commands (id → handler) ────────────────────────────────
  for (const [id, handler] of SIMPLE_COMMANDS) {
    context.subscriptions.push(hostEditor.registerCommand(id, handler));
  }

  // ── Inline formatting (marker-based) ─────────────────────────────
  for (const [id, marker] of INLINE_FORMATS) {
    context.subscriptions.push(hostEditor.registerCommand(id, () => toggleWrap(marker)));
  }

  // ── Table keybindings ─────────────────────────────────────────────
  for (const [id, handler] of tableKeybindingCommands) {
    context.subscriptions.push(hostEditor.registerCommand(id, handler));
  }

  // ── Commands with closures / special args ─────────────────────────

  // Outline tree view (needs outlineProvider instance)
  const outlineProvider = new HeadingOutlineProvider();
  hostEditor.registerTreeDataProvider(TreeView.outline, outlineProvider);
  hostEditor.onDidChangeActiveTextEditor(() => outlineProvider.refresh());
  // Coalesce per-keystroke outline refreshes; the underlying scan is fast
  // but firing it on every typed character is wasted work.
  let outlineRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleOutlineRefresh() {
    if (outlineRefreshTimer) clearTimeout(outlineRefreshTimer);
    outlineRefreshTimer = setTimeout(() => {
      outlineRefreshTimer = undefined;
      outlineProvider.refresh();
    }, 150);
  }
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.refreshOutline, () => outlineProvider.refresh()),
    hostEditor.onDidChangeTextDocument(scheduleOutlineRefresh),
  );

  // Backlinks panel (needs backlinksProvider instance)
  const backlinksProvider = new BacklinksProvider();
  hostEditor.registerTreeDataProvider(TreeView.backlinks, backlinksProvider);
  context.subscriptions.push(hostEditor.registerCommand(Cmd.refreshBacklinks, () => backlinksProvider.refresh()));

  // Database entry command (complex arg handling for webview calls)
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.dbAddEntry, async (...args: any[]) => {
      const parsed = parseCommandArgs(args);
      if (parsed.kind === "fsPath") {
        // Called from webview — path string + optional defaults
        const defaults = parsed.rest[0] as Record<string, string> | undefined;
        const doc = await hostEditor.openTextDocument(parsed.fsPath);
        const pos = new Position(doc.lineCount - 1, 0);
        await handleDbEntryCommand(doc, pos, false, defaults);
      } else if (parsed.kind === "slash") {
        const doc = await hostEditor.openTextDocument(Uri.parse(parsed.docUri));
        const pos = new Position(parsed.line, parsed.character);
        await handleDbEntryCommand(doc, pos, true);
      } else {
        const doc = hostEditor.getDocument();
        if (!doc) {
          hostEditor.showWarning("Lotion: No active editor. Open a database index.md file first.");
          return;
        }
        await handleDbEntryCommand(doc, hostEditor.getCursorPosition()!, false);
      }
    }),
  );

  // Comment commands (special arg types)
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.resolveComment, (docPath: string, id: string) => resolveComment(docPath, id)),
    hostEditor.registerCommand(Cmd.deleteComment, (docPath: string, id: string) => deleteComment(docPath, id)),
    hostEditor.registerCommand(Cmd.updateDate, (docUri: string, line: number, charStart: number, charEnd: number) =>
      handleUpdateDate(docUri, line, charStart, charEnd),
    ),
  );

  // ── Feature providers (no command registration) ──────────────────

  // CodeLens generators (stateless)

  for (const generator of CODELENS_GENERATORS) {
    context.subscriptions.push(createCodeLensProvider(generator));
  }

  // CodeLens providers (stateful or custom)
  context.subscriptions.push(createBacklinkCodeLensProvider(), createCommentCodeLensProvider());

  context.subscriptions.push(
    // Completion & drop providers
    createSlashCompletionProvider(),
    createLinkCompletionProvider(),
    createImageDropProvider(),
    createImagePasteProvider(),
    // Decorations
    createEditorDecorations(),
    createHeadingColors(),
    createListMarkerColors(),
    createStrikethroughDecorations(),
    // Auto-fixers & validators
    createListRenumber(),
    createListSwapMarker(),
    createTableAlignOnSave(),
    createSmartTypography(),
    createAutoInlineCode(),
    createLinkFactory(),
    createTocAutoUpdater(),
    createStructureLinter(),
    createLinkValidator(),
    createSecretboxGuard(),
    createSecretboxSaveGuard(),
    // Hover providers
    createImageHoverProvider(),
    createLinkHoverProvider(),
    // Status bars
    createWordCountStatusBar(),
    createReadingProgress(),
    createLineLock(),
    // Tree views & trackers
    createRecentPagesTracker(),
    createPageIconProvider(),
    createBookmarkTreeView(),
  );

  // Refresh DB webviews on save + drop cached isDbFile classification for the
  // saved file (it may have just gained or lost its `lotion-db` fence).
  context.subscriptions.push(
    hostEditor.onDidSaveTextDocument((doc) => {
      invalidateDbFileCache(doc.uri.fsPath);
      refreshAllDbWebviews();
    }),
  );

  // ── Markdown preview plugin ──────────────────────────────
  return {
    extendMarkdownIt(md: any) {
      const plugin = require("./core/markdownItPlugin");
      return plugin(md) || md;
    },
  };
}

export function deactivate() {}
