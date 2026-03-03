import React, { useRef, useEffect } from "react";
import { InlineEditorProps } from "../../../types/";

// ── Inline editor component ─────────────────────────────────────────

export function InlineEditor({ colType, currentVal, options, onCommit, onCancel }: InlineEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  if (colType === "select") {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        className="inline-edit-input"
        style={{ width: "100%", boxSizing: "border-box" }}
        defaultValue={currentVal}
        onChange={(e) => onCommit(e.target.value)}
        onBlur={onCancel}
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (colType === "multi-select") {
    const selected = currentVal
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      <div className="ms-edit">
        {options.map((o) => (
          <label key={o} style={{ display: "block", fontSize: 11 }}>
            <input
              type="checkbox"
              defaultChecked={selected.includes(o)}
              value={o}
              onChange={(e) => {
                const container = e.target.closest(".ms-edit")!;
                const checked = container.querySelectorAll("input:checked") as NodeListOf<HTMLInputElement>;
                const vals = Array.from(checked)
                  .map((c) => c.value)
                  .join(", ");
                onCommit(vals);
              }}
            />{" "}
            {o}
          </label>
        ))}
      </div>
    );
  }

  const inputType = colType === "date" ? "date" : colType === "number" ? "number" : colType === "url" ? "url" : "text";
  const placeholder = colType === "url" ? "https://..." : colType === "image" ? ".rsrc/image.png" : undefined;

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className="inline-edit-input"
      style={{ width: "100%", boxSizing: "border-box" }}
      type={inputType}
      defaultValue={currentVal}
      placeholder={placeholder}
      onChange={(e) => {
        if (colType === "date") onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit((e.target as HTMLInputElement).value);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => {
        if (colType !== "date") onCommit(e.target.value);
        else onCancel();
      }}
    />
  );
}
