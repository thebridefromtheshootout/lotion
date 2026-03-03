import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";

// ── Daily note ─────────────────────────────────────────────────────
//
// Opens (or creates) a daily note file at `journal/YYYY-MM-DD.md`
// within the workspace root. Populates with a basic template when
// creating a new note.

export async function openDailyNote(): Promise<void> {
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    hostEditor.showWarning("No workspace folder open.");
    return;
  }

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  const cfg = hostEditor.getConfiguration("lotion");
  const journalFolder = cfg.get<string>("dailyNotePath", "journal");

  const journalDir = path.join(workspaceRoot, journalFolder);
  const filePath = path.join(journalDir, `${dateStr}.md`);

  // Create journal/ if needed
  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true });
  }

  // Create the daily note if it doesn't exist
  if (!fs.existsSync(filePath)) {
    const template = [
      "---",
      `date: ${dateStr}`,
      "type: daily",
      "---",
      "",
      `# ${dayName}, ${dateStr}`,
      "",
      "## Tasks",
      "",
      "- [ ] ",
      "",
      "## Notes",
      "",
      "",
      "",
    ].join("\n");

    fs.writeFileSync(filePath, template, "utf-8");
  }

  const doc = await hostEditor.openTextDocument(filePath);
  await hostEditor.showTextDocument(doc);
}
