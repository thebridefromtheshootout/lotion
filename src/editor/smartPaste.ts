import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { getCwd } from "../core/cwd";
import { Regex } from "../core/regex";
import { escHtml } from "../core/html";
import { probeClipboardImage, imageFromClipboard } from "../media/clipboard";
import { isImagePasteProviderActive } from "../media/imagePaste";
import { cursorInCodeContext } from "./codeContext";

import { buildAnchorTag, deriveImageAlt, isImageUrl } from "./smartPasteAnchor";
import { tryParseTableData } from "./smartPasteTable";

// ── Re-exports for the public API ──────────────────────────────────

export { buildAnchorTag, truncateLabel, deriveUrlLabel } from "./smartPasteAnchor";
export { decodeHtmlEntities, extractTitle, fetchPageTitle } from "./smartPasteTitleFetch";

// ── Smart-paste tracing ────────────────────────────────────────────

const SMART_PASTE_LOG_PREFIX = "[Lotion][smartPaste]";
const shownClipboardDependencyErrors = new Set<string>();

/**
 * Smart-paste tracing fires on every Ctrl+V. Only emit when the user has
 * explicitly opted in via `lotion.smartPaste.debug`; otherwise the log
 * stream pollutes the dev console for everyone.
 */
function logSmartPaste(step: string, details?: Record<string, unknown>): void {
  if (!hostEditor.getConfiguration("lotion").get<boolean>("smartPaste.debug", false)) {
    return;
  }
  if (details) {
    console.debug(`${SMART_PASTE_LOG_PREFIX} ${step}`, details);
  } else {
    console.debug(`${SMART_PASTE_LOG_PREFIX} ${step}`);
  }
}

// ── Smart paste (Ctrl+V with link & image detection) ──────────────

export async function handleSmartPaste() {
  logSmartPaste("start");
  if (!hostEditor.isMarkdownEditor()) {
    logSmartPaste("not-markdown-editor -> default-paste");
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const document = hostEditor.getDocument();
  const cursor = hostEditor.getCursorPosition();
  if (document && cursor && cursorInCodeContext(document, cursor)) {
    logSmartPaste("cursor-in-code-context -> default-paste");
    // Preserve literal paste behavior while editing code snippets/blocks.
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const selection = hostEditor.getSelection()!;
  logSmartPaste("selection-state", { isEmpty: selection.isEmpty });

  // ── Link-wrap: selected text + URL on clipboard → HTML link/image ──
  if (!selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    logSmartPaste("selection+clipboard", { clipboardLength: clipText.length, looksLikeUrl: Regex.httpUrl.test(clipText) });
    if (Regex.httpUrl.test(clipText)) {
      try {
        const url = new URL(clipText);
        const hrefOrSrc = escHtml(clipText);
        const selectedText = hostEditor.getDocumentText(selection).trim();
        if (isImageUrl(url)) {
          logSmartPaste("selected-url->html-image");
          const alt = escHtml(selectedText || deriveImageAlt(url));
          await hostEditor.replaceCurrentSelection(`<img src="${hrefOrSrc}" alt="${alt}">`);
        } else {
          logSmartPaste("selected-url->html-anchor");
          await hostEditor.replaceCurrentSelection(await buildAnchorTag(clipText, selectedText || undefined));
        }
        return;
      } catch {
        logSmartPaste("selected-url-parse-failed -> continue");
        // Malformed URL — fall through to normal paste
      }
    }
  }

  // ── Auto-link: no selection + bare URL on clipboard → HTML link/image ──
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    logSmartPaste("empty-selection+clipboard", { clipboardLength: clipText.length, looksLikeUrl: Regex.httpUrl.test(clipText) });
    if (Regex.httpUrl.test(clipText)) {
      try {
        const url = new URL(clipText);
        const hrefOrSrc = escHtml(clipText);
        if (isImageUrl(url)) {
          logSmartPaste("auto-url->html-image");
          const alt = escHtml(deriveImageAlt(url));
          await hostEditor.insertAtCursor(`<img src="${hrefOrSrc}" alt="${alt}">`);
        } else {
          logSmartPaste("auto-url->html-anchor");
          await hostEditor.insertAtCursor(await buildAnchorTag(clipText));
        }
        return;
      } catch {
        logSmartPaste("auto-url-parse-failed -> continue");
        // Malformed URL — fall through to normal paste
      }
    }
  }

  // ── Table paste: TSV/CSV clipboard → markdown table ────────────
  if (selection.isEmpty) {
    const clipText = (await hostEditor.getClipboardText()).trim();
    const tableResult = tryParseTableData(clipText);
    if (tableResult) {
      logSmartPaste("table-detected->insert-markdown-table");
      await hostEditor.insertAtCursor(tableResult);
      return;
    }
    logSmartPaste("table-not-detected");
  }

  // ── Image paste: clipboard image → save & insert ───────────────
  // When the native paste-edit provider is active (VS Code 1.97+), the
  // image branch is handled there — give the built-in paste a chance to
  // dispatch it, skipping the powershell.exe / wslpath / xclip shell-out
  // entirely. The shell-out path below is preserved as a fallback for
  // older VS Code versions.
  if (isImagePasteProviderActive()) {
    logSmartPaste("image-paste-provider-active -> default-paste");
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }
  const cwd = getCwd();
  const clipProbe = probeClipboardImage();
  logSmartPaste("image-path-check", { hasCwd: !!cwd, hasClipboardImage: clipProbe.hasImage });
  if (!cwd || !clipProbe.hasImage) {
    if (clipProbe.missingDependencyMessage && !shownClipboardDependencyErrors.has(clipProbe.missingDependencyMessage)) {
      shownClipboardDependencyErrors.add(clipProbe.missingDependencyMessage);
      await hostEditor.showError(clipProbe.missingDependencyMessage);
    }
    logSmartPaste("image-path-bypass -> default-paste");
    await hostEditor.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const rsrcDir = path.join(cwd, ".rsrc");
  if (!fs.existsSync(rsrcDir)) {
    fs.mkdirSync(rsrcDir, { recursive: true });
    logSmartPaste("created-rsrc-dir", { rsrcDir });
  }

  const defaultName = new Date().toISOString().replace(Regex.colonDot, "-");
  const imageName = await hostEditor.showInputBox({
    prompt: "Name for the image (without extension)",
    value: defaultName,
    valueSelection: [0, defaultName.length],
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Image name cannot be empty";
      }
      if (Regex.invalidPathChars.test(value)) {
        return "Image name contains invalid characters";
      }
      return undefined;
    },
  });

  if (!imageName) {
    logSmartPaste("image-name-cancelled");
    return;
  }
  logSmartPaste("image-name-confirmed", { imageName });

  const savedFileName = await imageFromClipboard(rsrcDir, imageName);
  if (!savedFileName) {
    logSmartPaste("image-save-failed");
    return;
  }
  logSmartPaste("image-saved", { savedFileName });

  const relativePath = `.rsrc/${savedFileName}`;
  const escapedAlt = imageName.replace(Regex.doubleQuote, "&quot;");
  const imgTag = `<img src="${relativePath}" alt="${escapedAlt}">`;
  if (selection.isEmpty) {
    logSmartPaste("insert-local-image-at-cursor");
    await hostEditor.insertAtCursor(imgTag);
  } else {
    logSmartPaste("replace-selection-with-local-image");
    await hostEditor.replaceCurrentSelection(imgTag);
  }
  await hostEditor.saveActiveDocument();
  logSmartPaste("done");
}
