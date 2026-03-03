
import { Selection } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";

// ── Inline formatting toggle ───────────────────────────────────────
export async function toggleWrap(marker: string) {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const ops: EditOp[] = [];
  const selections = hostEditor.getSelections();
  for (const selection of selections) {
    if (selection.isEmpty) {
      // No selection → insert marker pair and we'll place cursor between them after
      ops.push({ type: OpType.Insert, position: selection.active, text: `${marker}${marker}` });
    } else {
      const text = hostEditor.getDocumentText(selection);
      if (text.startsWith(marker) && text.endsWith(marker) && text.length > marker.length * 2) {
        // Already wrapped → unwrap
        ops.push({ type: OpType.Replace, range: selection, text: text.slice(marker.length, -marker.length) });
      } else {
        // Wrap
        ops.push({ type: OpType.Replace, range: selection, text: `${marker}${text}${marker}` });
      }
    }
  }
  await hostEditor.batchEdit(ops);

  // If any selection was empty, move cursors between the inserted markers
  const updatedSelections = hostEditor.getSelections();
  if (updatedSelections.some((s) => s.isEmpty)) {
    hostEditor.setSelections(
      updatedSelections.map((sel) => {
        const pos = sel.active.translate(0, -marker.length);
        return new Selection(pos, pos);
      }),
    );
  }
}
