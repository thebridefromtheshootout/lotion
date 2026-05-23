import React from "react";
import { createRoot } from "react-dom/client";
// Codicons font + class definitions, bundled into every app's CSS so the
// <Icon name="…"> component works without per-app imports.
import "@vscode/codicons/dist/codicon.css";

export function bootstrapRoot(app: React.JSX.Element): void {
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const root = createRoot(container);
  root.render(app);
}
