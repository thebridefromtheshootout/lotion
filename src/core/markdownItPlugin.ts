// @ts-nocheck
/**
 * Markdown-it plugin for Lotion.
 *
 * Provides custom rendering for:
 *   - ==highlight== → <mark>text</mark>
 *   - Callout blocks: > [!NOTE], > [!TIP], > [!WARNING], etc.
 *
 * This file is loaded by VS Code's markdown preview via
 * contributes.markdown.markdownItPlugins.
 */
import { Regex } from "./regex";

function lotionMarkdownItPlugin(md) {
  // ── ==highlight== ──────────────────────────────────────────
  // Match ==text== and convert to <mark>
  md.inline.ruler.before("emphasis", "highlight", (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x3d /* = */ || state.src.charCodeAt(state.pos + 1) !== 0x3d) {
      return false;
    }

    // Find closing ==
    const start = state.pos + 2;
    let end = state.src.indexOf("==", start);
    if (end === -1) {
      return false;
    }

    if (!silent) {
      const token = state.push("highlight_open", "mark", 1);
      token.markup = "==";

      const inner = state.push("text", "", 0);
      inner.content = state.src.slice(start, end);

      const close = state.push("highlight_close", "mark", -1);
      close.markup = "==";
    }

    state.pos = end + 2;
    return true;
  });

  // ── Callout blocks ─────────────────────────────────────────
  // Convert blockquotes starting with [!TYPE] into callout divs
  const defaultBlockquoteOpen = md.renderer.rules.blockquote_open;
  const defaultBlockquoteClose = md.renderer.rules.blockquote_close;

  md.core.ruler.after("block", "callout", (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") {
        continue;
      }

      // Look at the first inline content inside the blockquote
      let inlineIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_close" && tokens[j].level === tokens[i].level) {
          break;
        }
        if (tokens[j].type === "inline") {
          inlineIdx = j;
          break;
        }
      }

      if (inlineIdx === -1) {
        continue;
      }

      const content = tokens[inlineIdx].content;
      const calloutMatch = content.match(Regex.calloutTokenWithText);
      if (!calloutMatch) {
        continue;
      }

      const type = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1);

      // Mark the blockquote tokens with callout info
      tokens[i].attrSet("class", `callout callout-${type}`);
      tokens[i].tag = "div";

      // Replace the inline content (remove the [!TYPE] prefix)
      const icon = { note: "ℹ️", tip: "💡", warning: "⚠️", important: "🔥", caution: "🛑" }[type] || "📌";
      tokens[inlineIdx].content = content.replace(Regex.calloutTokenWithText, "$2");

      // Insert a callout title before the content
      const titleOpen = new state.Token("html_block", "", 0);
      titleOpen.content = `<div class="callout-title">${icon} ${title}</div>`;
      tokens.splice(inlineIdx, 0, titleOpen);

      // Fix the closing tag
      for (let j = inlineIdx + 1; j < tokens.length; j++) {
        if (tokens[j].type === "blockquote_close" && tokens[j].level === tokens[i].level) {
          tokens[j].tag = "div";
          break;
        }
      }
    }
  });
}

module.exports = lotionMarkdownItPlugin;
