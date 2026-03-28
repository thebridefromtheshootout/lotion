import React from "react";
import { createRoot } from "react-dom/client";

export function bootstrapRoot(app: React.JSX.Element): void {
  const container = document.getElementById("root");
  if (!container) {
    return;
  }
  const root = createRoot(container);
  root.render(app);
}
