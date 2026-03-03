import {
  commands,
  DecorationOptions,
  Disposable,
  env,
  ExtensionContext,
  FileDecorationProvider,
  InputBoxOptions,
  languages,
  Position,
  QuickPickItem,
  QuickPickOptions,
  Range,
  Selection,
  SnippetString,
  TextDocument,
  TextDocumentShowOptions,
  TextEditor,
  TextEditorDecorationType,
  TextEditorRevealType,
  TextEditorSelectionChangeEvent,
  TextEditorVisibleRangesChangeEvent,
  TextLine,
  TreeDataProvider,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";
import type {
  CancellationToken,
  CodeLensProvider,
  CompletionItemProvider,
  DecorationRenderOptions,
  DiagnosticCollection,
  DocumentDropEditProvider,
  DocumentSelector,
  FileDeleteEvent,
  FileRenameEvent,
  GlobPattern,
  OpenDialogOptions,
  Progress,
  ProgressOptions,
  QuickPick,
  SaveDialogOptions,
  StatusBarAlignment,
  StatusBarItem,
  TextDocumentChangeEvent,
  TextDocumentWillSaveEvent,
  TreeView,
  TreeViewOptions,
  WebviewOptions,
  WebviewPanel,
  WebviewPanelOptions,
  WorkspaceConfiguration,
} from "vscode";
import { getExtensionUri, getWebviewShellHtml } from "../core/webviewShell";

/** The kind of edit operation. */
export enum OpType {
  Replace = "replace",
  Insert = "insert",
  Delete = "delete",
}

/** A single edit operation for use with `batchEdit`. */
export type EditOp =
  | { type: OpType.Replace; range: Range; text: string }
  | { type: OpType.Insert; position: Position; text: string }
  | { type: OpType.Delete; range: Range };

/** Options forwarded to the underlying editor.edit() call. */
export interface EditOptions {
  undoStopBefore: boolean;
  undoStopAfter: boolean;
}

/** Re-export InputBoxOptions from vscode for convenience. */
export type { InputBoxOptions };

/** Re-export QuickPickItem and QuickPickOptions from vscode for convenience. */
export type { QuickPickItem, QuickPickOptions, TextLine };

/**
 *
 * Consumers call high-level methods instead of reaching into
 * vscode namespaces directly.  Migrate usage one method at a time
 * from HostEditor re-exports to this class.
 */
class HostingEditor {
  private context: ExtensionContext | undefined;

  /** Store the extension context for automatic subscription management. */
  init(context: ExtensionContext): void {
    this.context = context;
  }

  /** Push a disposable into context.subscriptions and return it. */
  private subscribe(disposable: Disposable): Disposable {
    this.context?.subscriptions.push(disposable);
    return disposable;
  }

  // ── Event subscriptions (auto-pushed to context.subscriptions) ───

  /** Listen for active editor changes. */
  onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => any): Disposable {
    return this.subscribe(window.onDidChangeActiveTextEditor(listener));
  }

  /** Listen for text editor selection changes. */
  onDidChangeTextEditorSelection(listener: (e: TextEditorSelectionChangeEvent) => any): Disposable {
    return this.subscribe(window.onDidChangeTextEditorSelection(listener));
  }

  /** Listen for visible range changes. */
  onDidChangeTextEditorVisibleRanges(listener: (e: TextEditorVisibleRangesChangeEvent) => any): Disposable {
    return this.subscribe(window.onDidChangeTextEditorVisibleRanges(listener));
  }

  // ── Registration wrappers (auto-pushed to context.subscriptions) ─

  /** Register a tree data provider. */
  registerTreeDataProvider<T>(viewId: string, provider: TreeDataProvider<T>): Disposable {
    return this.subscribe(window.registerTreeDataProvider(viewId, provider));
  }

  /** Register a file decoration provider. */
  registerFileDecorationProvider(provider: FileDecorationProvider): Disposable {
    return this.subscribe(window.registerFileDecorationProvider(provider));
  }

  // ── Clipboard ────────────────────────────────────────────────────

  /** Read raw text from the system clipboard. */
  async getClipboardText(): Promise<string> {
    return env.clipboard.readText();
  }

  /** Replace the current selection with the given text. */
  async replaceCurrentSelection(text: string): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      eb.replace(editor.selection, text);
    });
  }

  /** Insert text at the current cursor position. */
  async insertAtCursor(text: string): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      eb.insert(editor.selection.active, text);
    });
  }

  /** Replace the content of a given range with new text. */
  async replaceRange(range: Range, text: string, options?: EditOptions): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      eb.replace(range, text);
    }, options);
  }

  /** Apply multiple range replacements in a single atomic edit. */
  async batchReplaceRanges(edits: { range: Range; text: string }[]): Promise<void> {
    if (edits.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      for (const e of edits) {
        eb.replace(e.range, e.text);
      }
    });
  }

  /** Insert text at an arbitrary position in the active document. */
  async insertAt(position: Position, text: string, options?: EditOptions): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      eb.insert(position, text);
    }, options);
  }

  /** Apply multiple inserts in a single atomic edit. */
  async batchInsertAt(edits: { position: Position; text: string }[]): Promise<void> {
    if (edits.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      for (const e of edits) {
        eb.insert(e.position, e.text);
      }
    });
  }

  /** Delete the content within a given range. */
  async deleteRange(range: Range): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      eb.delete(range);
    });
  }

  /** Delete multiple ranges in a single atomic edit. */
  async batchDeleteRanges(ranges: Range[]): Promise<void> {
    if (ranges.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      for (const r of ranges) {
        eb.delete(r);
      }
    });
  }

  /** Apply a mix of insert / replace / delete operations in a single atomic edit. */
  async batchEdit(ops: EditOp[]): Promise<void> {
    if (ops.length === 0) {
      return;
    }
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.edit((eb) => {
      for (const op of ops) {
        switch (op.type) {
          case OpType.Insert:
            eb.insert(op.position, op.text);
            break;
          case OpType.Replace:
            eb.replace(op.range, op.text);
            break;
          case OpType.Delete:
            eb.delete(op.range);
            break;
        }
      }
    });
  }

  /** Insert a snippet at the given location (Position or Range). */
  async insertSnippet(snippet: SnippetString, location?: Position | Range): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.insertSnippet(snippet, location);
  }

  /** Scroll the editor viewport to reveal the given range. */
  revealRange(range: Range, revealType?: TextEditorRevealType): void {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.revealRange(range, revealType);
  }

  /** Return text from the active document — full text or within a range. */
  getDocumentText(range?: Range): string {
    const editor = window.activeTextEditor;
    if (!editor) {
      return "";
    }
    return editor.document.getText(range);
  }

  /** Check if the active editor is a markdown document. */
  isMarkdownEditor(): boolean {
    const editor = window.activeTextEditor;
    return editor !== undefined && editor.document.languageId === "markdown";
  }

  /** Check if the active editor's document matches the given document. */
  isActiveEditorDocumentEqualTo(document: TextDocument): boolean {
    const editor = window.activeTextEditor;
    return editor !== undefined && editor.document === document;
  }

  /** Save the active document. */
  async saveActiveDocument(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    await editor.document.save();
  }

  /** Show an information message (fire-and-forget, no return value). */
  async showInformation(message: string): Promise<void> {
    await window.showInformationMessage(message);
  }

  /** Show a warning message (fire-and-forget, no return value). */
  async showWarning(message: string): Promise<void> {
    await window.showWarningMessage(message);
  }

  /** Show an error message (fire-and-forget, no return value). */
  async showError(message: string): Promise<void> {
    await window.showErrorMessage(message);
  }

  /** Show an information message with action items; returns the selected item. */
  async showInformationMessage<T extends string = string>(message: string, items?: T[]): Promise<T | undefined> {
    if (!items || items.length === 0) {
      await window.showInformationMessage(message);
      return undefined;
    }
    return window.showInformationMessage(message, ...items) as Promise<T | undefined>;
  }

  /** Show a warning message with action items; returns the selected item. */
  async showWarningMessage<T extends string = string>(message: string, items?: T[]): Promise<T | undefined> {
    if (!items || items.length === 0) {
      await window.showWarningMessage(message);
      return undefined;
    }
    return window.showWarningMessage(message, ...items) as Promise<T | undefined>;
  }

  /** Show an error message with action items; returns the selected item. */
  async showErrorMessage<T extends string = string>(message: string, items?: T[]): Promise<T | undefined> {
    if (!items || items.length === 0) {
      await window.showErrorMessage(message);
      return undefined;
    }
    return window.showErrorMessage(message, ...items) as Promise<T | undefined>;
  }

  /** Show a modal warning message with action items; returns the selected item. */
  async showWarningModal<T extends string = string>(message: string, items?: T[]): Promise<T | undefined> {
    if (!items || items.length === 0) {
      await window.showWarningMessage(message, { modal: true });
      return undefined;
    }
    return window.showWarningMessage(message, { modal: true }, ...items) as Promise<T | undefined>;
  }

  /** Show an input box prompt; returns the entered text or undefined if cancelled. */
  async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
    return window.showInputBox(options);
  }

  /** Show a quick pick with string items; returns the selected string or undefined if cancelled. */
  async showQuickPick(
    items: readonly string[],
    options?: QuickPickOptions & { canPickMany?: false },
  ): Promise<string | undefined>;

  /** Show a quick pick with string items and multi-select; returns an array of selected strings or undefined if cancelled. */
  async showQuickPick(
    items: readonly string[],
    options: QuickPickOptions & { canPickMany: true },
  ): Promise<string[] | undefined>;

  /** Show a quick pick with typed items; returns the selected item or undefined if cancelled. */
  async showQuickPick<T extends QuickPickItem>(
    items: readonly T[],
    options?: QuickPickOptions & { canPickMany?: false },
  ): Promise<T | undefined>;

  /** Show a quick pick with typed items and multi-select; returns an array of selected items or undefined if cancelled. */
  async showQuickPick<T extends QuickPickItem>(
    items: readonly T[],
    options: QuickPickOptions & { canPickMany: true },
  ): Promise<T[] | undefined>;

  async showQuickPick<T extends QuickPickItem>(
    items: readonly string[] | readonly T[],
    options?: QuickPickOptions,
  ): Promise<string | T | string[] | T[] | undefined> {
    return window.showQuickPick(items as any, options) as any;
  }

  /** Open a text document in the editor. */
  async showTextDocument(document: TextDocument, options?: TextDocumentShowOptions): Promise<TextEditor>;
  async showTextDocument(document: TextDocument, column?: ViewColumn): Promise<TextEditor>;
  async showTextDocument(
    document: TextDocument,
    optionsOrColumn?: TextDocumentShowOptions | ViewColumn,
  ): Promise<TextEditor> {
    const options = typeof optionsOrColumn === "number" ? { viewColumn: optionsOrColumn } : optionsOrColumn;
    return await window.showTextDocument(document, options);
  }

  /** Get the current cursor position. */
  getCursorPosition(): Position | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.selection.active;
  }

  /** Get the current selection. */
  getSelection(): Selection | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.selection;
  }

  /** Get all current selections (multi-cursor). Returns empty array if no editor. */
  getSelections(): readonly Selection[] {
    const editor = window.activeTextEditor;
    if (!editor) {
      return [];
    }
    return editor.selections;
  }

  /** Set the current selection. */
  setSelection(selection: Selection): void {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.selection = selection;
  }

  /** Set all selections (multi-cursor). */
  setSelections(selections: readonly Selection[]): void {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.selections = selections as Selection[];
  }

  /** Get a TextLine from the active document (text, range, etc.). */
  getLine(line: number): TextLine {
    const editor = window.activeTextEditor;
    if (!editor) {
      throw new Error("No active editor");
    }
    return editor.document.lineAt(line);
  }

  /** Get the active document, or undefined if no editor is open. */
  getDocument(): TextDocument | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document;
  }

  /** Get the URI of the active document. */
  getDocumentUri(): Uri | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    return editor.document.uri;
  }

  /** Get the line count of the active document. */
  getLineCount(): number {
    const editor = window.activeTextEditor;
    if (!editor) {
      return 0;
    }
    return editor.document.lineCount;
  }

  /** Get a specific line of text from the active document. */
  getLineText(line: number): string {
    const editor = window.activeTextEditor;
    if (!editor) {
      return "";
    }
    return editor.document.lineAt(line).text;
  }

  /** Apply decorations to the active editor. */
  setDecorations(decorationType: TextEditorDecorationType, ranges: Range[] | DecorationOptions[]): void {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    editor.setDecorations(decorationType, ranges);
  }

  /** Get the currently visible ranges in the active editor. */
  getVisibleRanges(): readonly Range[] {
    const editor = window.activeTextEditor;
    if (!editor) {
      return [];
    }
    return editor.visibleRanges;
  }

  /** Get the tab size setting of the active editor. */
  getTabSize(): number {
    const editor = window.activeTextEditor;
    if (!editor) {
      return 2;
    }
    const tabSize = editor.options.tabSize;
    return typeof tabSize === "number" ? tabSize : 2;
  }

  /** Execute a VS Code command by ID. */
  async executeCommand(command: string, ...args: unknown[]): Promise<void> {
    await commands.executeCommand(command, ...args);
  }

  // ── workspace ─────────────────────────────────────────────────────

  /** Open a text document by URI or file path. */
  async openTextDocument(uriOrPath: Uri | string): Promise<TextDocument> {
    return await workspace.openTextDocument(uriOrPath as any);
  }

  /** Get all currently open text documents. */
  getTextDocuments(): readonly TextDocument[] {
    return workspace.textDocuments;
  }

  /** Get the workspace folders. */
  getWorkspaceFolders() {
    return workspace.workspaceFolders;
  }

  /** Search for files matching a glob pattern. */
  async findFiles(include: GlobPattern, exclude?: GlobPattern | null, maxResults?: number): Promise<Uri[]> {
    return await workspace.findFiles(include, exclude ?? undefined, maxResults);
  }

  /** Apply a WorkspaceEdit. */
  async applyWorkspaceEdit(edit: WorkspaceEdit): Promise<boolean> {
    return await workspace.applyEdit(edit);
  }

  /** Get a workspace configuration section. */
  getConfiguration(section?: string): WorkspaceConfiguration {
    return workspace.getConfiguration(section);
  }

  /** Delete a file via the workspace file system. */
  deleteFile(uri: Uri): Thenable<void> {
    return workspace.fs.delete(uri);
  }

  /** Listen for text document content changes. */
  onDidChangeTextDocument(listener: (e: TextDocumentChangeEvent) => any): Disposable {
    return this.subscribe(workspace.onDidChangeTextDocument(listener));
  }

  /** Listen for text document saves. */
  onDidSaveTextDocument(listener: (doc: TextDocument) => any): Disposable {
    return this.subscribe(workspace.onDidSaveTextDocument(listener));
  }

  /** Listen for pre-save events. */
  onWillSaveTextDocument(listener: (e: TextDocumentWillSaveEvent) => any): Disposable {
    return this.subscribe(workspace.onWillSaveTextDocument(listener));
  }

  /** Listen for text documents being opened. */
  onDidOpenTextDocument(listener: (doc: TextDocument) => any): Disposable {
    return this.subscribe(workspace.onDidOpenTextDocument(listener));
  }

  /** Listen for text documents being closed. */
  onDidCloseTextDocument(listener: (doc: TextDocument) => any): Disposable {
    return this.subscribe(workspace.onDidCloseTextDocument(listener));
  }

  /** Listen for file renames. */
  onDidRenameFiles(listener: (e: FileRenameEvent) => any): Disposable {
    return this.subscribe(workspace.onDidRenameFiles(listener));
  }

  /** Listen for file deletions. */
  onDidDeleteFiles(listener: (e: FileDeleteEvent) => any): Disposable {
    return this.subscribe(workspace.onDidDeleteFiles(listener));
  }

  // ── window (additional) ──────────────────────────────────────────

  /** Create a text editor decoration type. */
  createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
    return window.createTextEditorDecorationType(options);
  }

  /** Create a status bar item. */
  createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
    return window.createStatusBarItem(alignment!, priority);
  }

  /** Create a quick pick widget. */
  createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
    return window.createQuickPick<T>();
  }

  /** Create a tree view. */
  createTreeView<T>(viewId: string, options: TreeViewOptions<T>): TreeView<T> {
    return this.subscribe(window.createTreeView(viewId, options)) as unknown as TreeView<T>;
  }

  /** Show an open dialog. */
  showOpenDialog(options: OpenDialogOptions): Promise<Uri[] | undefined> {
    return window.showOpenDialog(options) as Promise<Uri[] | undefined>;
  }

  /** Show a save dialog. */
  showSaveDialog(options: SaveDialogOptions): Promise<Uri | undefined> {
    return window.showSaveDialog(options) as Promise<Uri | undefined>;
  }

  /** Show a progress notification. */
  withProgress<T>(
    options: ProgressOptions,
    task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Promise<T>,
  ): Promise<T> {
    return window.withProgress(options, task) as Promise<T>;
  }

  /** Get all currently visible text editors. */
  getVisibleTextEditors(): readonly TextEditor[] {
    return window.visibleTextEditors;
  }

  // ── commands (additional) ────────────────────────────────────────

  /** Register a command (auto-subscribed). */
  registerCommand(commandId: string, callback: (...args: any[]) => any): Disposable {
    return this.subscribe(commands.registerCommand(commandId, callback));
  }

  // ── languages ────────────────────────────────────────────────────

  /** Register a CodeLens provider (auto-subscribed). */
  registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
    return this.subscribe(languages.registerCodeLensProvider(selector, provider));
  }

  /** Register a completion item provider (auto-subscribed). */
  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    ...triggerChars: string[]
  ): Disposable {
    return this.subscribe(languages.registerCompletionItemProvider(selector, provider, ...triggerChars));
  }

  /** Register a hover provider (auto-subscribed). */
  registerHoverProvider(selector: DocumentSelector, provider: any): Disposable {
    return this.subscribe(languages.registerHoverProvider(selector, provider));
  }

  /** Register a document drop edit provider (auto-subscribed). */
  registerDocumentDropEditProvider(selector: DocumentSelector, provider: DocumentDropEditProvider): Disposable {
    return this.subscribe(languages.registerDocumentDropEditProvider(selector, provider));
  }

  /** Create a diagnostic collection (auto-subscribed). */
  createDiagnosticCollection(name?: string): DiagnosticCollection {
    const dc = languages.createDiagnosticCollection(name);
    this.subscribe(dc);
    return dc;
  }

  // ── env ──────────────────────────────────────────────────────────

  /** Open an external URI in the default browser/application. */
  openExternal(target: Uri): Promise<boolean> {
    return env.openExternal(target) as Promise<boolean>;
  }

  /** Reveal a file or folder in the OS file explorer. */
  async revealFileInOS(fsPath: string): Promise<void> {
    await commands.executeCommand("revealFileInOS", Uri.file(fsPath));
  }

  /** Read text from the system clipboard. */
  async readClipboardText(): Promise<string> {
    return env.clipboard.readText();
  }

  /** Write text to the system clipboard. */
  async writeClipboardText(text: string): Promise<void> {
    await env.clipboard.writeText(text);
  }

  // ── webview panels ───────────────────────────────────────────────

  /**
   * Create a webview panel, wire up its HTML shell, and return it.
   * @param viewType  Unique panel identifier (e.g. `Panel.commentPane`)
   * @param title     Human-readable panel title
   * @param appName   React app entry point name (resolves to `out/webview/<appName>.js`)
   * @param showOptions  Column or show-options object
   * @param options   Optional extra CSP directives and/or additional local resource roots
   */
  createWebviewPanel(
    viewType: string,
    title: string,
    appName: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
    options?: { extraCsp?: string[]; extraLocalResourceRoots?: Uri[] },
  ): WebviewPanel {
    const roots = [
      Uri.joinPath(getExtensionUri(), "out"),
      Uri.joinPath(getExtensionUri(), "media"),
      ...(options?.extraLocalResourceRoots ?? []),
    ];
    const panel = window.createWebviewPanel(viewType, title, showOptions, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: roots,
    });
    panel.webview.html = getWebviewShellHtml({
      webview: panel.webview,
      appName,
      title,
      extraCsp: options?.extraCsp,
    });
    return panel;
  }
}

/** Singleton instance used across the extension. */
export const hostEditor = new HostingEditor();
