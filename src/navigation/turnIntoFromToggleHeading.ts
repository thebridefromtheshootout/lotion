import { Position, Range } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument, TextLine } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";

const TOGGLE_HEADING_SUMMARY_RE = Regex.toggleHeadingSummary;

// ── Toggle Heading → something else ────────────────────────────────

export async function turnIntoFromToggleHeading(doc: TextDocument, detailsLine: TextLine): Promise<void> {
  const startLine = detailsLine.lineNumber;

  // Next line should be <summary><hN>...</hN></summary>
  if (startLine + 1 >= doc.lineCount) {
    return;
  }
  const summaryText = doc.lineAt(startLine + 1).text;
  const summaryMatch = summaryText.match(TOGGLE_HEADING_SUMMARY_RE);
  if (!summaryMatch) {
    hostEditor.showInformation("Lotion: Place cursor on a toggle heading to use Turn Into.");
    return;
  }

  const currentLevel = parseInt(summaryMatch[1], 10);
  const headingText = summaryMatch[2];

  // Find the closing </details> tag
  let closingLine = -1;
  for (let i = startLine + 2; i < doc.lineCount; i++) {
    if (doc.lineAt(i).text.trim() === "</details>") {
      closingLine = i;
      break;
    }
  }
  if (closingLine === -1) {
    return;
  }

  interface TurnIntoOption extends QuickPickItem {
    id: string;
  }

  const options: TurnIntoOption[] = [];

  // Offer regular heading levels
  for (let lv = 1; lv <= 3; lv++) {
    options.push({
      label: `Heading ${lv}`,
      description: `${"#".repeat(lv)} ${headingText}`,
      id: `h${lv}`,
    });
  }

  // Offer other toggle heading levels
  for (let lv = 1; lv <= 3; lv++) {
    if (lv !== currentLevel) {
      options.push({
        label: `Toggle Heading ${lv}`,
        description: `<details><summary><h${lv}>${headingText}</h${lv}></summary>`,
        id: `t${lv}`,
      });
    }
  }

  const pick = await hostEditor.showQuickPick(options, {
    placeHolder: `Turn toggle "${headingText}" into…`,
  });

  if (!pick) {
    return;
  }

  // Extract body lines (between </summary> and </details>)
  const bodyLines: string[] = [];
  for (let i = startLine + 2; i < closingLine; i++) {
    bodyLines.push(doc.lineAt(i).text);
  }

  // Trim leading/trailing blank lines
  while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  const replaceRange = new Range(
    new Position(startLine, 0),
    new Position(closingLine, doc.lineAt(closingLine).text.length),
  );

  if (pick.id.startsWith("h")) {
    const newLevel = parseInt(pick.id[1], 10);
    const prefix = "#".repeat(newLevel);
    const bodyText = bodyLines.length > 0 ? `\n\n${bodyLines.join("\n")}` : "";
    await hostEditor.replaceRange(replaceRange, `${prefix} ${headingText}${bodyText}`);
  } else if (pick.id.startsWith("t")) {
    const newLevel = parseInt(pick.id[1], 10);
    const hTag = `h${newLevel}`;
    const bodyText = bodyLines.length > 0 ? `\n${bodyLines.join("\n")}\n` : "\n";
    const replacement = `<details>\n<summary><${hTag}>${headingText}</${hTag}></summary>\n${bodyText}\n</details>`;
    await hostEditor.replaceRange(replaceRange, replacement);
  }
}
