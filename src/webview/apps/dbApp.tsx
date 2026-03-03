import React from "react";
import { createRoot } from "react-dom/client";
import { DatabaseViewRoot } from "../components/database/DatabaseViewRoot";
import "./dbApp.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<DatabaseViewRoot />);
}
