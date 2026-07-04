import { CodeLens, Range } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { Cmd } from "../core/commands";
import { parseImageLine } from "./imageBlock";

// ── Image CodeLens generator ───────────────────────────────────────
//
// Surfaces the image slash commands (align / size / caption / alt) as
// clickable buttons above every line that carries an image, so the
// actions are reachable without the user remembering the command
// names. Copy-path and Reveal live only in the slash palette — they
// don't earn a permanent slot in the on-screen action bar.

interface Button {
  title: string;
  command: string;
}

const LAYOUT_BUTTONS: Button[] = [
  { title: "Left", command: Cmd.imgAlignLeft },
  { title: "Right", command: Cmd.imgAlignRight },
  { title: "Center", command: Cmd.imgAlignCenter },
  { title: "Reset", command: Cmd.imgReset },
  { title: "S", command: Cmd.imgSizeS },
  { title: "M", command: Cmd.imgSizeM },
  { title: "L", command: Cmd.imgSizeL },
  { title: "Full", command: Cmd.imgSizeFull },
];

export function generateImageLenses(document: TextDocument): CodeLens[] {
  const lenses: CodeLens[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    const parsed = parseImageLine(line);
    if (!parsed) continue;

    const range = new Range(i, 0, i, 0);
    const args = [document.uri.toString(), i, 0];

    for (const btn of LAYOUT_BUTTONS) {
      lenses.push(
        new CodeLens(range, {
          title: btn.title,
          command: btn.command,
          arguments: args,
        }),
      );
    }

    // Add-alt only when the image has no alt text — cuts the CodeLens
    // row down to just the layout row for images that are already labelled.
    if (!parsed.model.alt) {
      lenses.push(
        new CodeLens(range, {
          title: "Add alt",
          command: Cmd.imgAlt,
          arguments: args,
        }),
      );
    }
  }

  return lenses;
}
