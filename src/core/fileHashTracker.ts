// ── File hash tracker ───────────────────────────────────────────────
// Tracks content hashes of saved files so that slash-command handlers can
// detect whether a document had unsaved changes *before* the user typed
// the "/" trigger text.

import * as crypto from "crypto";
import { hostEditor } from "../hostEditor/HostingEditor";
import type { TextDocument, Disposable } from "../hostEditor/EditorTypes";

/** filepath → hash of last-known saved content */
const savedHashes = new Map<string, string>();

function hash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function keyFor(doc: TextDocument): string {
  return doc.uri.fsPath;
}

/** Returns true if the document content matches the last saved hash. */
export function matchesSavedHash(doc: TextDocument): boolean {
  const h = savedHashes.get(keyFor(doc));
  if (h === undefined) return false;
  return h === hash(doc.getText());
}

/**
 * Register open / save / close listeners that keep the hash map in sync.
 * Call once during activation and push the returned Disposable into
 * context.subscriptions.
 */
export function createFileHashTracker(): Disposable {
  // Seed with every already-open document
  for (const doc of hostEditor.getTextDocuments()) {
    if (!doc.isDirty) {
      savedHashes.set(keyFor(doc), hash(doc.getText()));
    }
  }

  const d1 = hostEditor.onDidOpenTextDocument((doc) => {
    if (!doc.isDirty) {
      savedHashes.set(keyFor(doc), hash(doc.getText()));
    }
  });

  const d2 = hostEditor.onDidSaveTextDocument((doc) => {
    savedHashes.set(keyFor(doc), hash(doc.getText()));
  });

  const d3 = hostEditor.onDidCloseTextDocument((doc) => {
    savedHashes.delete(keyFor(doc));
  });

  return {
    dispose() {
      d1.dispose();
      d2.dispose();
      d3.dispose();
      savedHashes.clear();
    },
  };
}
