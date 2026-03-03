/**
 * Minimal VS Code API mock for unit tests.
 *
 * Only stubs the symbols that tested modules actually import at the
 * module level.  Individual tests should add deeper stubs when needed.
 */

export enum OverviewRulerLane {
  Left = 1,
  Center = 2,
  Right = 4,
  Full = 7,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: any,
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number,
  ) {}
}

export class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
  translate(lineDelta?: number, charDelta?: number) {
    return new Position(this.line + (lineDelta ?? 0), this.character + (charDelta ?? 0));
  }
}

export class Selection extends Range {}

export class MarkdownString {
  value = "";
  supportHtml = false;
  isTrusted = false;
  appendMarkdown(s: string) {
    this.value += s;
    return this;
  }
}

export class Hover {
  constructor(
    public contents: any,
    public range?: Range,
  ) {}
}

export class TreeItem {
  constructor(
    public label: string,
    public collapsibleState?: any,
  ) {}
  tooltip?: string;
  description?: string;
  iconPath?: any;
  command?: any;
}

export class SnippetString {
  constructor(public value: string) {}
}

export class Disposable {
  static from(...disposables: any[]) {
    return new Disposable();
  }
  dispose() {}
}

export class EventEmitter<T> {
  event = () => {};
  fire(_data?: T) {}
  dispose() {}
}

export class Uri {
  static file(p: string) {
    return { fsPath: p, toString: () => `file:///${p}` };
  }
  static parse(s: string) {
    return { fsPath: s, toString: () => s };
  }
}

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: () => undefined,
    update: async () => {},
  }),
  onDidChangeTextDocument: () => new Disposable(),
  onDidSaveTextDocument: () => new Disposable(),
  onDidChangeConfiguration: () => new Disposable(),
};

export const window = {
  activeTextEditor: undefined,
  visibleTextEditors: [],
  createStatusBarItem: () => ({
    text: "",
    tooltip: "",
    command: "",
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  createTextEditorDecorationType: () => ({
    dispose: () => {},
  }),
  createTreeView: () => ({
    dispose: () => {},
  }),
  onDidChangeActiveTextEditor: () => new Disposable(),
  onDidChangeTextEditorSelection: () => new Disposable(),
  onDidChangeTextEditorVisibleRanges: () => new Disposable(),
  showTextDocument: async () => ({}),
  showQuickPick: async () => undefined,
  showInputBox: async () => undefined,
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  createWebviewPanel: () => ({
    webview: { html: "", onDidReceiveMessage: () => new Disposable() },
    reveal: () => {},
    dispose: () => {},
    onDidDispose: () => new Disposable(),
  }),
};

export const commands = {
  registerCommand: () => new Disposable(),
  registerTextEditorCommand: () => new Disposable(),
  executeCommand: async () => {},
};

export const languages = {
  registerHoverProvider: () => new Disposable(),
  registerCompletionItemProvider: () => new Disposable(),
  registerCodeLensProvider: () => new Disposable(),
};

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Event = 23,
}

export class CompletionItem {
  constructor(
    public label: any,
    public kind?: CompletionItemKind,
  ) {}
  insertText?: any;
  detail?: string;
  documentation?: any;
  command?: any;
  sortText?: string;
  filterText?: string;
}

export class CompletionList {
  constructor(
    public items: CompletionItem[] = [],
    public isIncomplete = false,
  ) {}
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}
