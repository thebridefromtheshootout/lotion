import { Selection } from "../hostEditor/EditorTypes";
import { hostEditor, OpType, type EditOp } from "../hostEditor/HostingEditor";

// ── Inline formatting toggle ───────────────────────────────────────
export async function toggleWrap(marker: string, event?: KeyboardEvent) {
  if (!hostEditor.isMarkdownEditor()) {
    return;
  }
  const ops: EditOp[] = [];
  const selections = hostEditor.getSelections();
  for (const selection of selections) {
    if (selection.isEmpty) {
      // no selection, don't do anything.
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
}
