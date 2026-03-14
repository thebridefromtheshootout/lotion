import { Position, Range, WorkspaceEdit } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

function escapeRegex(text: string): string {
  return text.replace(Regex.regexMetaCharsGlobal, "\\$&");
}

/**
 * Replace all references from old page path -> new page path across markdown files.
 * Paths are expected to be workspace-relative (slash-separated).
 */
export async function relinkWorkspacePagePaths(oldRelFromRoot: string, newRelFromRoot: string): Promise<number> {
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  let updatedCount = 0;
  const escaped = escapeRegex(oldRelFromRoot);
  const pathRegex = new RegExp(escaped, "g");

  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      const text = doc.getText();
      if (!pathRegex.test(text)) {
        continue;
      }

      const newText = text.replace(pathRegex, newRelFromRoot);
      const edit = new WorkspaceEdit();
      const fullRange = new Range(
        new Position(0, 0),
        new Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length),
      );
      edit.replace(uri, fullRange, newText);
      await hostEditor.applyWorkspaceEdit(edit);
      await doc.save();
      updatedCount++;
    } catch {
      // skip files that cannot be edited
    }
  }

  return updatedCount;
}
