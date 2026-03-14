import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";
import { cursorInCodeContext } from "./codeContext";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Position } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Regex } from "../core/regex";

export const COPY_SLASH_COMMAND: SlashCommand = {
  label: "/copy",
  insertText: "",
  detail: "📋 Copy code (inline span or block)",
  isAction: true,
  commandId: Cmd.copyCode,
  kind: 2,
  when: cursorInCodeContext,
  handler: handleCopyCodeCommand,
};

export async function handleCopyCodeCommand(document: TextDocument, position: Position): Promise<void> {
  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const selection = hostEditor.getSelection();
  if (selection && !selection.isEmpty) {
    await hostEditor.executeCommand(Cmd.copyToClipboard);
    return;
  }

  const fenced = findEnclosingFencedCodeBlock(document, position.line);
  if (fenced) {
    const text = readLines(document, fenced.start + 1, fenced.end - 1);
    await hostEditor.writeClipboardText(text);
    return;
  }

  const inline = findInlineCodeSpan(document.lineAt(position.line).text, position.character);
  if (inline) {
    await hostEditor.writeClipboardText(inline);
    return;
  }

  await hostEditor.executeCommand(Cmd.copyToClipboard);
}

function findEnclosingFencedCodeBlock(
  document: TextDocument,
  line: number,
): { start: number; end: number } | undefined {
  let openLine = -1;

  for (let i = 0; i <= line && i < document.lineCount; i++) {
    if (Regex.fencedCodeDelimiter.test(document.lineAt(i).text)) {
      if (openLine === -1) {
        openLine = i;
      } else {
        openLine = -1;
      }
    }
  }

  if (openLine === -1) {
    return undefined;
  }

  for (let i = openLine + 1; i < document.lineCount; i++) {
    if (Regex.fencedCodeDelimiter.test(document.lineAt(i).text)) {
      return { start: openLine, end: i };
    }
  }

  return { start: openLine, end: document.lineCount - 1 };
}

function readLines(document: TextDocument, startLine: number, endLine: number): string {
  if (endLine < startLine || startLine < 0 || startLine >= document.lineCount) {
    return "";
  }

  const lines: string[] = [];
  const maxLine = Math.min(endLine, document.lineCount - 1);
  for (let i = startLine; i <= maxLine; i++) {
    lines.push(document.lineAt(i).text);
  }
  return lines.join("\n");
}

function findInlineCodeSpan(lineText: string, cursorChar: number): string | undefined {
  let openTick = -1;
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] !== "`") {
      continue;
    }
    if (openTick === -1) {
      openTick = i;
      continue;
    }

    const closeTick = i;
    if (cursorChar > openTick && cursorChar <= closeTick) {
      return lineText.slice(openTick + 1, closeTick);
    }
    openTick = -1;
  }
  return undefined;
}
