import React from "react";

// ── Generic draggable wrapper ──────────────────────────────────────
//
// Thin abstraction over an HTML5-draggable <div>. Centralises the
// `draggable` attribute toggle and the dragstart event hook so callers
// can compose drag sources without reimplementing the dance every
// time. Drop-target behaviour is intentionally left to the caller —
// pass `onDragOver` / `onDrop` etc. via `rest` when the same element
// also accepts drops.

export interface DraggableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "draggable" | "onDragStart"> {
  /** When false, the element renders as a non-draggable container. */
  enabled: boolean;
  /** Fires on dragstart; event already has stopPropagation called. */
  onDragStart: (ev: React.DragEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export function Draggable({ enabled, onDragStart, children, ...rest }: DraggableProps) {
  return (
    <div
      {...rest}
      draggable={enabled}
      onDragStart={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        onDragStart(e);
      }}
    >
      {children}
    </div>
  );
}
