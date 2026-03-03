import { hostEditor } from "../hostEditor/HostingEditor";
import { Disposable, Position, Range, TextEdit } from "../hostEditor/EditorTypes";

// ── Auto trailing newline ──────────────────────────────────────────
//
// Ensures markdown files always end with exactly one trailing newline
// on save, following the POSIX convention and preventing diff noise.

export function createTrailingNewlineFixer(): Disposable {
  return hostEditor.onWillSaveTextDocument((e) => {
    if (e.document.languageId !== "markdown") {
      return;
    }
    if (!hostEditor.getConfiguration("lotion").get<boolean>("trailingNewline", true)) {
      return;
    }

    const document = e.document;
    const lastLine = document.lineCount - 1;
    const lastLineText = document.lineAt(lastLine).text;

    // If file already ends with a single empty line, nothing to do
    if (lastLine > 0 && lastLineText === "" && document.lineAt(lastLine - 1).text.trim() !== "") {
      return;
    }

    e.waitUntil(
      Promise.resolve(
        [
          (() => {
            // Trim trailing empty lines and add exactly one
            let trimTo = lastLine;
            while (trimTo > 0 && document.lineAt(trimTo).text.trim() === "") {
              trimTo--;
            }

            const edits: TextEdit[] = [];

            if (trimTo < lastLine) {
              // Remove excess blank lines at end
              edits.push(
                TextEdit.delete(
                  new Range(
                    new Position(trimTo, document.lineAt(trimTo).text.length),
                    new Position(lastLine, lastLineText.length),
                  ),
                ),
              );
            }

            // Ensure trailing newline (the file should end with \n)
            // VS Code handles this if insertFinalNewline is set, but we ensure it
            if (trimTo === lastLine && lastLineText.length > 0) {
              edits.push(TextEdit.insert(new Position(lastLine, lastLineText.length), "\n"));
            }

            return edits;
          })(),
        ].flat(),
      ),
    );
  });
}
