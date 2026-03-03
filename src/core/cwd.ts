import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";

// ── Current working directory (parent of active file) ──────────────
let cwd: string | undefined;

export function getCwd(): string | undefined {
  return cwd;
}

export function updateCwd() {
  const uri = hostEditor.getDocumentUri();
  if (uri && uri.scheme === "file") {
    cwd = path.dirname(uri.fsPath);
  }
}
