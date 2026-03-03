import { Position, Range, Uri, ViewColumn, WorkspaceEdit } from "../../hostEditor/EditorTypes";
import type { WebviewPanel } from "../../hostEditor/EditorTypes";
import { hostEditor } from "../../hostEditor/HostingEditor";
import { Panel } from "../../core/commands";
import { ExtensionToDatePanelCommunicator } from "../../communicators/datePanelCommunicator";
import { lastFormat, setLastFormat } from "./dateCommands";
import { Cmd } from "../../core/commands";
import type { SlashCommand } from "../../core/slashCommands";
import type { TextDocument } from "../../hostEditor/EditorTypes";

export const DATE_SLASH_COMMAND: SlashCommand = {
  label: "/date",
  insertText: "",
  detail: "\ud83d\uddd3\ufe0f Insert a specific date",
  isAction: true,
  commandId: Cmd.insertDate,
  kind: 12,
  handler: handleDateCommand,
};

// ── Date picker webview panel ──────────────────────────────────────

let datePanel: WebviewPanel | undefined;
let communicator: ExtensionToDatePanelCommunicator | undefined;

/**
 * Returns `true` when a new panel was created, `false` when reused.
 */
function ensurePanel(title: string): boolean {
  if (datePanel) {
    datePanel.reveal(ViewColumn.Beside);
    return false;
  }

  datePanel = hostEditor.createWebviewPanel(Panel.datePicker, title, "dateApp", ViewColumn.Beside);

  const comm = new ExtensionToDatePanelCommunicator(datePanel.webview);
  communicator = comm;

  comm.registerOnInsertDate(async (msg) => {
    const we = new WorkspaceEdit();
    const uri = Uri.parse(msg.docUri);
    if (msg.replaceEnd !== undefined) {
      we.replace(uri, new Range(msg.line, msg.character, msg.line, msg.replaceEnd), msg.formatted);
    } else {
      we.insert(uri, new Position(msg.line, msg.character), msg.formatted);
    }
    await hostEditor.applyWorkspaceEdit(we);
    setLastFormat(msg.format);
    datePanel?.dispose();
  });

  comm.registerOnClose(() => {
    datePanel?.dispose();
  });

  datePanel.onDidDispose(() => {
    datePanel = undefined;
    communicator = undefined;
  });

  return true;
}

/**
 * /date – opens a calendar webview for date picking.
 */
export async function handleDateCommand(
  _document: import("../../hostEditor/EditorTypes").TextDocument,
  position: Position,
): Promise<void> {
  const docUri = _document.uri.toString();
  const line = position.line;
  const character = position.character;

  const isNew = ensurePanel("📅 Pick a Date");

  if (isNew) {
    communicator!.registerOnReady(() => {
      communicator!.sendInit(lastFormat());
      communicator!.sendSetTarget({ docUri, line, character });
    });
  } else {
    communicator!.sendSetTarget({ docUri, line, character });
  }
}

/**
 * Open the calendar webview in "update" mode — replaces an existing date string.
 * Called from the date codelens.
 */
export async function handleUpdateDate(
  docUri: string,
  line: number,
  character: number,
  replaceEnd: number,
): Promise<void> {
  const doc = await hostEditor.openTextDocument(Uri.parse(docUri));
  const existingDate = doc.getText(new Range(line, character, line, replaceEnd));

  const isNew = ensurePanel("📅 Update Date");

  if (isNew) {
    communicator!.registerOnReady(() => {
      communicator!.sendInit(lastFormat());
      communicator!.sendSetTarget({ docUri, line, character, replaceEnd, existingDate });
    });
  } else {
    communicator!.sendSetTarget({ docUri, line, character, replaceEnd, existingDate });
  }
}
