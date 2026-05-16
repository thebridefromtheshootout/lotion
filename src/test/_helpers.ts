import * as vscode from "vscode";

// Shared helpers for integration tests. Keep this file small and
// stable — tests should read fluently against it.

export const EXTENSION_ID = "thebridefromtheshootout.lotion";

/** Open an untitled markdown document and reveal it in the editor.
 *  Forces tabSize=2 so list-indent tests don't depend on VS Code's user setting. */
export async function openMarkdown(content: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content, language: "markdown" });
  const editor = await vscode.window.showTextDocument(doc);
  editor.options = { ...editor.options, tabSize: 2, insertSpaces: true };
  return editor;
}

/** Move the cursor to a 0-indexed (line, character) position. */
export function setCursor(editor: vscode.TextEditor, line: number, character: number): void {
  const pos = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(pos, pos);
}

/** Set a selection range. */
export function setSelection(
  editor: vscode.TextEditor,
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
): void {
  editor.selection = new vscode.Selection(
    new vscode.Position(startLine, startChar),
    new vscode.Position(endLine, endChar),
  );
}

/** Read the full editor text. */
export function getText(editor: vscode.TextEditor): string {
  return editor.document.getText();
}

/** Execute a VS Code command. */
export async function run(command: string, ...args: unknown[]): Promise<unknown> {
  return await vscode.commands.executeCommand(command, ...args);
}

/** Close every editor between tests so state doesn't leak. */
export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

/** Activate the extension once; subsequent calls are no-ops. */
export async function activate(): Promise<void> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension ${EXTENSION_ID} not found`);
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}
