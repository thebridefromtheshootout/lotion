import React from "react";
import { createRoot } from "react-dom/client";
import { GifPreview } from "../components/GifPreview";
import "./gifApp.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<GifPreview />);
}
