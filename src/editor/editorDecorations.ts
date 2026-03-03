import { Disposable, OverviewRulerLane, Range } from "../hostEditor/EditorTypes";
import type { DecorationOptions, TextEditorDecorationType } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";

// ── Editor decorations for callouts, highlights, and code blocks ───
//
// Brings the Markdown-preview aesthetic into the source editor:
//  • Callout lines (> [!TYPE]) get tinted backgrounds + gutter icons
//  • ==highlighted text== gets a warm yellow background
//  • Fenced code block ranges get a subtle grey background

// ───── Callout decorations ─────────────────────────────────────────

interface CalloutTheme {
  light: string;
  dark: string;
  gutterIcon: string;
}

const CALLOUT_THEMES: Record<string, CalloutTheme> = {
  NOTE: { light: "rgba(68,138,255,0.07)", dark: "rgba(68,138,255,0.10)", gutterIcon: "info" },
  TIP: { light: "rgba(0,200,83,0.07)", dark: "rgba(0,200,83,0.10)", gutterIcon: "lightbulb" },
  WARNING: { light: "rgba(255,145,0,0.07)", dark: "rgba(255,145,0,0.10)", gutterIcon: "warning" },
  IMPORTANT: { light: "rgba(170,0,255,0.07)", dark: "rgba(170,0,255,0.10)", gutterIcon: "megaphone" },
  CAUTION: { light: "rgba(255,23,68,0.07)", dark: "rgba(255,23,68,0.10)", gutterIcon: "flame" },
};

const CALLOUT_BORDER_COLORS: Record<string, { light: string; dark: string }> = {
  NOTE: { light: "#448aff", dark: "#448aff" },
  TIP: { light: "#00c853", dark: "#00c853" },
  WARNING: { light: "#ff9100", dark: "#ff9100" },
  IMPORTANT: { light: "#aa00ff", dark: "#aa00ff" },
  CAUTION: { light: "#ff1744", dark: "#ff1744" },
};

function createCalloutDecorationTypes(): Map<string, TextEditorDecorationType> {
  const types = new Map<string, TextEditorDecorationType>();

  for (const [key, theme] of Object.entries(CALLOUT_THEMES)) {
    const border = CALLOUT_BORDER_COLORS[key];
    types.set(
      key,
      hostEditor.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: theme.light,
        borderWidth: "0 0 0 3px",
        borderStyle: "solid",
        borderColor: border.light,
        borderRadius: "2px",
        gutterIconPath: undefined, // vscode gutterIcons need file URIs; use overviewRuler instead
        overviewRulerColor: border.light,
        overviewRulerLane: OverviewRulerLane.Left,
        dark: {
          backgroundColor: theme.dark,
          borderColor: border.dark,
          overviewRulerColor: border.dark,
        },
      }),
    );
  }

  return types;
}

// ───── Highlight decoration (==text==) ─────────────────────────────

function createHighlightDecorationType(): TextEditorDecorationType {
  return hostEditor.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 235, 59, 0.35)",
    borderRadius: "2px",
    dark: {
      backgroundColor: "rgba(255, 235, 59, 0.20)",
    },
  });
}

// ───── Code block background tinting ───────────────────────────────

function createCodeBlockDecorationType(): TextEditorDecorationType {
  return hostEditor.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(128, 128, 128, 0.06)",
    borderRadius: "3px",
    dark: {
      backgroundColor: "rgba(128, 128, 128, 0.08)",
    },
  });
}

// ───── Combined update logic ───────────────────────────────────────

const CALLOUT_OPEN_RE = /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i;
const CALLOUT_CONT_RE = /^>/;
const HIGHLIGHT_RE = /==[^=\n]+?==/g;
const FENCE_RE = /^```/;

export function createEditorDecorations(): Disposable {
  const calloutTypes = createCalloutDecorationTypes();
  const highlightType = createHighlightDecorationType();
  const codeBlockType = createCodeBlockDecorationType();

  function update(): void {
    if (!hostEditor.isMarkdownEditor()) {
      return;
    }
    const doc = hostEditor.getDocument()!;

    // Callout buckets
    const calloutBuckets: Map<string, DecorationOptions[]> = new Map();
    for (const key of calloutTypes.keys()) {
      calloutBuckets.set(key, []);
    }

    // Highlight ranges
    const highlightRanges: DecorationOptions[] = [];

    // Code block ranges
    const codeBlockRanges: DecorationOptions[] = [];

    let inFence = false;
    let currentCalloutType: string | null = null;

    for (let i = 0; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;

      // ── Fenced code blocks ──
      if (FENCE_RE.test(lineText.trim())) {
        if (inFence) {
          // Closing fence — include this line
          codeBlockRanges.push({
            range: new Range(i, 0, i, lineText.length),
          });
          inFence = false;
          continue;
        } else {
          inFence = true;
          codeBlockRanges.push({
            range: new Range(i, 0, i, lineText.length),
          });
          continue;
        }
      }

      if (inFence) {
        codeBlockRanges.push({
          range: new Range(i, 0, i, lineText.length),
        });
        continue;
      }

      // ── Callout blocks ──
      const calloutMatch = lineText.match(CALLOUT_OPEN_RE);
      if (calloutMatch) {
        currentCalloutType = calloutMatch[1].toUpperCase();
        const bucket = calloutBuckets.get(currentCalloutType);
        if (bucket) {
          bucket.push({ range: new Range(i, 0, i, lineText.length) });
        }
        continue;
      }

      if (currentCalloutType && CALLOUT_CONT_RE.test(lineText)) {
        const bucket = calloutBuckets.get(currentCalloutType);
        if (bucket) {
          bucket.push({ range: new Range(i, 0, i, lineText.length) });
        }
        continue;
      } else {
        currentCalloutType = null;
      }

      // ── Inline highlights ==text== ──
      let hm: RegExpExecArray | null;
      HIGHLIGHT_RE.lastIndex = 0;
      while ((hm = HIGHLIGHT_RE.exec(lineText)) !== null) {
        // Decorate just the content (skip the == markers)
        const contentStart = hm.index + 2;
        const contentEnd = hm.index + hm[0].length - 2;
        highlightRanges.push({
          range: new Range(i, contentStart, i, contentEnd),
        });
      }
    }

    // Apply decorations
    for (const [key, type] of calloutTypes) {
      hostEditor.setDecorations(type, calloutBuckets.get(key) ?? []);
    }
    hostEditor.setDecorations(highlightType, highlightRanges);
    hostEditor.setDecorations(codeBlockType, codeBlockRanges);
  }

  update();

  hostEditor.onDidChangeActiveTextEditor(update);
  const d2 = hostEditor.onDidChangeTextDocument((e) => {
    if (hostEditor.isActiveEditorDocumentEqualTo(e.document)) {
      update();
    }
  });

  const allTypes = [...calloutTypes.values(), highlightType, codeBlockType];
  return Disposable.from(...allTypes, d2);
}
