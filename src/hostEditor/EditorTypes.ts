/**
 * EditorTypes — Re-exports VS Code types, classes, and enums by name.
 *
 * Consumer files import individual symbols directly:
 *
 *     import { Range, Position, Selection } from "../EditorTypes";
 *
 * This keeps type references short (`Range` instead of `HostEditor.Range`)
 * while still funnelling every VS Code dependency through an explicit layer.
 */

// ── Classes / constructors ─────────────────────────────────────────
export {
  CodeLens,
  CompletionItem,
  Diagnostic,
  Disposable,
  DocumentDropEdit,
  EventEmitter,
  FileDecoration,
  Hover,
  MarkdownString,
  Position,
  Range,
  Selection,
  SnippetString,
  TextEdit,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  Uri,
  WorkspaceEdit,
} from "vscode";

// ── Enums / constants ──────────────────────────────────────────────
export {
  CompletionItemKind,
  ConfigurationTarget,
  DiagnosticSeverity,
  OverviewRulerLane,
  ProgressLocation,
  StatusBarAlignment,
  TextEditorRevealType,
  TreeItemCollapsibleState,
  ViewColumn,
} from "vscode";

// ── Type-only re-exports ───────────────────────────────────────────
export type {
  CancellationToken,
  CodeLensProvider,
  DataTransfer,
  DecorationOptions,
  DiagnosticCollection,
  ExtensionContext,
  FileDecorationProvider,
  HoverProvider,
  Progress,
  ProviderResult,
  QuickPickItem,
  StatusBarItem,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextDocumentShowOptions,
  TextEditor,
  TextEditorDecorationType,
  TextLine,
  TreeDataProvider,
  Webview,
  WebviewPanel,
} from "vscode";
