import { Position, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Cmd } from "../core/commands";
import { Regex } from "../core/regex";
import type { SlashCommand } from "../core/slashCommands";

export const PAGE_SLASH_COMMAND: SlashCommand = {
  label: "/page",
  insertText: "",
  detail: "📄 Create a child page",
  isAction: true,
  commandId: Cmd.createPage,
  kind: 16,
  handler: handlePageCommand,
};

// ── /page handler ──────────────────────────────────────────────────
export async function handlePageCommand(document: TextDocument, position: Position) {
  const cwd = getCwd();
  if (!cwd) {
    hostEditor.showError("Lotion: no active file directory.");
    return;
  }

  // 1) Ask the user for the page name
  const pageName = await hostEditor.showInputBox({
    prompt: "Enter the name of the new page",
    placeHolder: "my-new-page",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Page name cannot be empty";
      }
      if (Regex.invalidPathChars.test(value)) {
        return "Page name contains invalid characters";
      }
      return undefined;
    },
  });

  if (!pageName) {
    return; // user cancelled
  }

  // Convert page name to a folder-safe slug
  const folderName = pageName.toLowerCase().replace(/\s+/g, "-");
  const pageDir = path.join(cwd, folderName);
  const childFilePath = path.join(pageDir, "index.md");
  const relativePath = `${folderName}/index.md`;

  // 2) Create the page folder
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  // 3) Insert a markdown link in the current document at the trigger position
  if (hostEditor.isActiveEditorDocumentEqualTo(document)) {
    const triggerRange = new Range(position.translate(0, -1), position);
    await hostEditor.replaceRange(triggerRange, `[${pageName}](${relativePath})`);
    await hostEditor.saveActiveDocument();
  }

  // 4) Create index.md and open it
  if (!fs.existsSync(childFilePath)) {
    fs.writeFileSync(childFilePath, `# ${pageName}\n\n`, "utf-8");
  }

  const childDoc = await hostEditor.openTextDocument(childFilePath);

  const cursorPos = new Position(2, 0);
  await hostEditor.showTextDocument(childDoc, {
    selection: new Range(cursorPos, cursorPos),
  });
}
