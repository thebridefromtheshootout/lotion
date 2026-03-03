import React from "react";
import { FormatCellProps } from "../../../types/";

export function FormatCell({
  value,
  type,
  baseUri,
  maxWidth,
  maxHeight,
}: FormatCellProps): React.JSX.Element {
  if (!value) return <></>;
  switch (type) {
    case "image": {
      // value is a relative path like ".rsrc/photo.png"
      const src = baseUri ? `${baseUri.replace(/\/$/, "")}/${value}` : value;
      const mw = maxWidth ?? 120;
      const mh = maxHeight ?? 80;
      return (
        <img src={src} alt={value} style={{ maxWidth: mw, maxHeight: mh, objectFit: "contain", display: "block" }} />
      );
    }
    case "select":
      return <span className="badge">{value}</span>;
    case "multi-select":
      return (
        <>
          {value.split(",").map((v, i) => (
            <span key={i} className="badge">
              {v.trim()}
            </span>
          ))}
        </>
      );
    case "checkbox":
      return <span className="check">{value === "true" ? "☑" : "☐"}</span>;
    case "url":
      return (
        <a href={value} style={{ color: "var(--accent)" }}>
          {value}
        </a>
      );
    case "coordinates":
      return <span className="coordinates" title="Geographic coordinates">📍 {value}</span>;
    default:
      return <>{value}</>;
  }
}
