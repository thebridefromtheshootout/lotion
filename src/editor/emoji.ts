import { Position, Range } from "../hostEditor/EditorTypes";
import type { QuickPickItem, TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import emojiData from "unicode-emoji-json";
import { Cmd } from "../core/commands";
import type { SlashCommand } from "../core/slashCommands";

export const EMOJI_SLASH_COMMAND: SlashCommand = {
  label: "/emoji",
  insertText: "",
  detail: "\ud83d\ude00 Insert an emoji",
  isAction: true,
  commandId: Cmd.insertEmoji,
  kind: 0,
  handler: handleEmojiCommand,
};

// ── Build searchable items (cached on first use) ───────────────────

interface EmojiItem extends QuickPickItem {
  emoji: string;
}

let cachedItems: EmojiItem[] | undefined;

function getEmojiItems(): EmojiItem[] {
  if (cachedItems) {
    return cachedItems;
  }

  cachedItems = Object.entries(emojiData).map(([emoji, info]) => ({
    label: emoji,
    description: `${info.name}  (${info.group})`,
    emoji,
  }));

  return cachedItems;
}

// ── /emoji handler ─────────────────────────────────────────────────

export async function handleEmojiCommand(document: TextDocument, position: Position): Promise<void> {
  const allItems = getEmojiItems();

  const qp = hostEditor.createQuickPick<EmojiItem>();
  qp.placeholder = "Search for an emoji…";
  qp.matchOnDescription = true;
  qp.items = allItems;

  qp.onDidChangeValue((query) => {
    if (!query) {
      qp.items = allItems;
      return;
    }
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored: { item: EmojiItem; score: number; unmatched: number }[] = [];

    for (const item of allItems) {
      const text = `${item.label} ${item.description ?? ""}`.toLowerCase();
      const nameTokens = (item.description ?? "")
        .toLowerCase()
        .split(/[\s()]+/)
        .filter(Boolean);

      // Every query token must appear somewhere in text
      if (!queryTokens.every((qt) => text.includes(qt))) {
        continue;
      }

      // Score: count how many query tokens have an exact match in nameTokens
      let exactMatches = 0;
      for (const qt of queryTokens) {
        if (nameTokens.includes(qt)) {
          exactMatches++;
        }
      }

      // Penalty: how many name tokens are NOT covered by any query token
      // (fewer unmatched tokens = closer to an exact set match)
      const unmatchedNameTokens = nameTokens.filter((nt) => !queryTokens.includes(nt)).length;

      // Higher score = more exact token matches (prioritized first)
      scored.push({ item, score: exactMatches, unmatched: unmatchedNameTokens });
    }

    scored.sort((a, b) => b.score - a.score || a.unmatched - b.unmatched);
    qp.items = scored.map((s) => s.item);
  });

  const pick = await new Promise<EmojiItem | undefined>((resolve) => {
    qp.onDidAccept(() => {
      resolve(qp.selectedItems[0]);
      qp.dispose();
    });
    qp.onDidHide(() => {
      resolve(undefined);
      qp.dispose();
    });
    qp.show();
  });

  if (!pick) {
    return;
  }

  if (!hostEditor.isActiveEditorDocumentEqualTo(document)) {
    return;
  }

  const triggerRange = new Range(position.translate(0, -1), position);
  await hostEditor.replaceRange(triggerRange, pick.emoji);
}
