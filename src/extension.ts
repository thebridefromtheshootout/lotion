import { hostEditor } from "./hostEditor/HostingEditor";
import { Position, Uri } from "./hostEditor/EditorTypes";
import type { ExtensionContext } from "./hostEditor/EditorTypes";
// ── Module barrels ──────────────────────────────────────────────────
import {
  updateCwd,
  createSlashCompletionProvider,
  createStructureLinter,
  createTrailingNewlineFixer,
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
  createFileHashTracker,
} from "./core";

import {
  handleUpdateDate,
  // createSnippetExpander,  // disabled
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

import { toggleWrap, createHeadingColors, createSmartPairs, createSmartTypography } from "./formatting";

import {
  createBacklinkCodeLensProvider,
  BacklinksProvider,
  createLinkCompletionProvider,
  createLinkHoverProvider,
  createLinkValidator,
} from "./links";

import { createListRenumber } from "./lists";

import { createBreadcrumbStatusBar, createHeadingAnchorDecorations, createRecentPagesTracker } from "./navigation";

import { refreshAllDbWebviews, handleDbEntryCommand, openDbWebview } from "./database";

import { createImageDropProvider, createImageHoverProvider } from "./media";

import {
  HeadingOutlineProvider,
  createPageIconProvider,
  createReadingProgress,
  createWordCountStatusBar,
} from "./views";

import {
  createBookmarkTreeView,
  createClipboardHistoryTracker,
  // createPomodoroStatusBar, // disabled
  // createTaskProgressStatusBar, // disabled
  createStrikethroughDecorations,
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

  // ── Track cursor-in-table context for keybinding priority ─────────
  const updateTableContext = () => {
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
  updateTableContext();
  hostEditor.onDidChangeActiveTextEditor(updateTableContext);
  hostEditor.onDidChangeTextEditorSelection(() => updateTableContext());

  // ── Slash-command handlers (docUri, line, character) ────────────
  // Register all slash commands with handlers from the master SLASH_COMMANDS array
  // (openDbWebview is excluded — it has custom arg handling below)
  for (const cmd of SLASH_COMMANDS.filter((c) => c.handler && c.commandId && c.commandId !== Cmd.openDbWebview)) {
    context.subscriptions.push(hostEditor.registerCommand(cmd.commandId!, slashHandler(cmd.handler!)));
  }

  // openDbWebview — called from CodeLens with a direct path, or from slash command with (docUri, line, char)
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.openDbWebview, async (...args: any[]) => {
      if (args.length >= 1 && typeof args[0] === "string" && !args[0].startsWith("file:")) {
        // Called from CodeLens — direct fsPath to the database index.md
        await openDbWebview(args[0]);
      } else if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "number") {
        // Called from slash command — (docUri, line, character)
        const doc = await hostEditor.openTextDocument(Uri.parse(args[0]));
        await openDbWebview(doc.uri.fsPath);
      } else {
        // Called from command palette — use active editor
        const doc = hostEditor.getDocument();
        if (!doc) {
          hostEditor.showWarning("Lotion: No active editor. Open a database file first.");
          return;
        }
        await openDbWebview(doc.uri.fsPath);
      }
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
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.refreshOutline, () => outlineProvider.refresh()),
    hostEditor.onDidChangeTextDocument(() => outlineProvider.refresh()),
  );

  // Backlinks panel (needs backlinksProvider instance)
  const backlinksProvider = new BacklinksProvider();
  hostEditor.registerTreeDataProvider(TreeView.backlinks, backlinksProvider);
  context.subscriptions.push(hostEditor.registerCommand(Cmd.refreshBacklinks, () => backlinksProvider.refresh()));

  // Database entry command (complex arg handling for webview calls)
  context.subscriptions.push(
    hostEditor.registerCommand(Cmd.dbAddEntry, async (...args: any[]) => {
      if (args.length >= 1 && typeof args[0] === "string" && !args[0].startsWith("file:")) {
        // Called from webview — path string + optional defaults
        const dbIndexPath = args[0];
        const defaults: Record<string, string> | undefined = args[1] ?? undefined;
        const doc = await hostEditor.openTextDocument(dbIndexPath);
        const pos = new Position(doc.lineCount - 1, 0);
        await handleDbEntryCommand(doc, pos, false, defaults);
      } else if (args.length >= 3 && typeof args[0] === "string" && typeof args[1] === "number") {
        // Called from slash command
        const [docUri, line, character] = args;
        const doc = await hostEditor.openTextDocument(Uri.parse(docUri));
        const pos = new Position(line, character);
        await handleDbEntryCommand(doc, pos, true);
      } else {
        // Called from command palette
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
    // Decorations
    createEditorDecorations(),
    createHeadingColors(),
    // createHeadingAnchorDecorations(),  // disabled
    createStrikethroughDecorations(),
    // Auto-fixers & validators
    createListRenumber(),
    createTableAlignOnSave(),
    // createSmartTypography(),  // disabled
    createTocAutoUpdater(),
    createStructureLinter(),
    createLinkValidator(),
    // createTrailingNewlineFixer(),  // disabled
    createSecretboxGuard(),
    createSecretboxSaveGuard(),
    // createSmartPairs(),  // disabled
    // createSnippetExpander(),  // disabled
    // Hover providers
    createImageHoverProvider(),
    createLinkHoverProvider(),
    // Status bars
    createWordCountStatusBar(),
    createBreadcrumbStatusBar(),
    createReadingProgress(),
    // createPomodoroStatusBar(), // disabled
    // createTaskProgressStatusBar(), // disabled
    // Tree views & trackers
    createRecentPagesTracker(),
    createPageIconProvider(),
    createBookmarkTreeView(),
    createClipboardHistoryTracker(),
  );

  // Refresh DB webviews on save
  context.subscriptions.push(hostEditor.onDidSaveTextDocument(() => refreshAllDbWebviews()));

  // ── Markdown preview plugin ──────────────────────────────
  return {
    extendMarkdownIt(md: any) {
      const plugin = require("./core/markdownItPlugin");
      return plugin(md) || md;
    },
  };
}

export function deactivate() {}
