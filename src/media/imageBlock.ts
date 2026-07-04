// ── Image block parser + serializer ────────────────────────────────
//
// The image CodeLens / slash commands need to inspect an image on a
// line, mutate its layout intent (align / size / caption / etc.), and
// write it back. Two source shapes both need to round-trip:
//
//   1. Markdown  — `![alt](src)`
//   2. HTML img — `<img src="..." alt="..." style="..." width="..." ...>`
//
// The parser normalises both into an ImageModel; the serializer picks
// the smallest shape that still expresses the model — plain markdown
// when there's no layout intent, and `<img>` otherwise (inline CSS is
// the only cross-renderer way to float / center / size an image).

export type ImageAlign = "left" | "right" | "center" | "none";
export type ImageSize = "S" | "M" | "L" | "full" | "custom" | "none";

export interface ImageModel {
  src: string;
  alt: string;
  align: ImageAlign;
  size: ImageSize;
  /** Set when size === "custom" — preserves user-authored width. */
  customWidth?: string;
  /** HTML attributes we preserve verbatim (title, class, id, etc.). */
  extraAttrs: Record<string, string>;
  /** CSS declarations we preserve verbatim (not layout-owned by us). */
  extraStyles: Record<string, string>;
}

export interface ParsedImage {
  model: ImageModel;
  /** Column offset of the matched image on the line. */
  startCol: number;
  /** End column (exclusive) of the matched image on the line. */
  endCol: number;
  /** Which shape the source used. */
  form: "md" | "html";
}

/** Named size buckets mapped to CSS widths. */
const SIZE_TO_WIDTH: Record<Exclude<ImageSize, "none" | "custom">, string> = {
  S: "150px",
  M: "300px",
  L: "500px",
  full: "100%",
};

// ── Parse ──────────────────────────────────────────────────────────

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/;
const HTML_IMAGE_RE = /<img\b([^>]*)\/?>/i;

/**
 * Find the first image on a line and return a normalised model.
 * Returns `null` if the line contains no image.
 */
export function parseImageLine(line: string): ParsedImage | null {
  const htmlMatch = line.match(HTML_IMAGE_RE);
  const mdMatch = line.match(MD_IMAGE_RE);

  // Prefer whichever matches earlier on the line; if both, whichever comes first.
  let use: "html" | "md" | null = null;
  if (htmlMatch && mdMatch) {
    use = (htmlMatch.index ?? Infinity) <= (mdMatch.index ?? Infinity) ? "html" : "md";
  } else if (htmlMatch) {
    use = "html";
  } else if (mdMatch) {
    use = "md";
  }
  if (!use) return null;

  if (use === "md") {
    const start = mdMatch!.index!;
    const alt = mdMatch![1];
    const src = mdMatch![2].trim();
    return {
      model: {
        src,
        alt,
        align: "none",
        size: "none",
        extraAttrs: {},
        extraStyles: {},
      },
      startCol: start,
      endCol: start + mdMatch![0].length,
      form: "md",
    };
  }

  const start = htmlMatch!.index!;
  const inner = htmlMatch![1];
  const attrs = parseHtmlAttrs(inner);

  const src = attrs.src ?? "";
  const alt = attrs.alt ?? "";
  delete attrs.src;
  delete attrs.alt;

  const styles = parseStyleAttr(attrs.style ?? "");
  delete attrs.style;

  const { align, size, customWidth, remainingStyles } = extractLayoutFromStyles(styles);

  // A `width="..."` HTML attribute is another way to express size.
  let finalSize = size;
  let finalCustomWidth = customWidth;
  if (attrs.width !== undefined) {
    if (finalSize === "none") {
      finalSize = "custom";
      finalCustomWidth = normaliseWidth(attrs.width);
    }
    delete attrs.width;
  }

  return {
    model: {
      src,
      alt,
      align,
      size: finalSize,
      customWidth: finalCustomWidth,
      extraAttrs: attrs,
      extraStyles: remainingStyles,
    },
    startCol: start,
    endCol: start + htmlMatch![0].length,
    form: "html",
  };
}

/**
 * Parse the attribute portion of `<img ...>`.
 * Handles `key="val"`, `key='val'`, and `key=val` (no quotes).
 */
function parseHtmlAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[key] = value;
  }
  return attrs;
}

/** Parse a CSS style string into a declaration map. */
function parseStyleAttr(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Pull the align / size we own out of a style map, returning the residual.
 * Rules:
 *   float: left  → align left  (drops matching margin)
 *   float: right → align right (drops matching margin)
 *   display: block + margin: * auto → align center
 *   width: 150px|300px|500px|100% → named size bucket
 *   width: <other> → custom size
 */
function extractLayoutFromStyles(styles: Record<string, string>): {
  align: ImageAlign;
  size: ImageSize;
  customWidth?: string;
  remainingStyles: Record<string, string>;
} {
  const remaining = { ...styles };
  let align: ImageAlign = "none";

  const float = remaining["float"];
  if (float === "left" || float === "right") {
    align = float;
    delete remaining["float"];
    delete remaining["margin"];
  } else if (remaining["display"] === "block" && /\bauto\b/.test(remaining["margin"] ?? "")) {
    align = "center";
    delete remaining["display"];
    delete remaining["margin"];
  }

  let size: ImageSize = "none";
  let customWidth: string | undefined;
  const width = remaining["width"];
  if (width) {
    const normalised = normaliseWidth(width);
    const bucket = (Object.keys(SIZE_TO_WIDTH) as (keyof typeof SIZE_TO_WIDTH)[]).find(
      (k) => SIZE_TO_WIDTH[k] === normalised,
    );
    if (bucket) {
      size = bucket;
    } else {
      size = "custom";
      customWidth = normalised;
    }
    delete remaining["width"];
  }

  return { align, size, customWidth, remainingStyles: remaining };
}

/** Add a `px` suffix to bare numbers so widths like `200` and `200px` compare equal. */
function normaliseWidth(w: string): string {
  const trimmed = w.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

// ── Serialize ──────────────────────────────────────────────────────

/**
 * Render an ImageModel back to the smallest form that expresses it.
 * A model with `align: none` + `size: none` + no extras collapses back
 * to `![alt](src)`; anything richer becomes an `<img>` tag.
 */
export function serializeImage(model: ImageModel): string {
  const hasLayout = model.align !== "none" || model.size !== "none";
  const hasExtras = Object.keys(model.extraAttrs).length > 0 || Object.keys(model.extraStyles).length > 0;

  if (!hasLayout && !hasExtras) {
    return `![${model.alt}](${model.src})`;
  }

  const styleParts: string[] = [];

  if (model.align === "left" || model.align === "right") {
    styleParts.push(`float: ${model.align}`, `margin: 1em`);
  } else if (model.align === "center") {
    styleParts.push(`display: block`, `margin: 1em auto`);
  }

  if (model.size !== "none") {
    const w = model.size === "custom" ? (model.customWidth ?? "auto") : SIZE_TO_WIDTH[model.size];
    styleParts.push(`width: ${w}`);
  }

  for (const [k, v] of Object.entries(model.extraStyles)) {
    styleParts.push(`${k}: ${v}`);
  }

  const attrs: string[] = [`src="${escapeAttr(model.src)}"`];
  if (model.alt) attrs.push(`alt="${escapeAttr(model.alt)}"`);
  if (styleParts.length > 0) attrs.push(`style="${styleParts.join("; ")};"`);
  for (const [k, v] of Object.entries(model.extraAttrs)) {
    attrs.push(`${k}="${escapeAttr(v)}"`);
  }

  return `<img ${attrs.join(" ")}>`;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
