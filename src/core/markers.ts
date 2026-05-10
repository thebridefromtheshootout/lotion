// Canonical lotion-* in-document marker strings.
//
// Lotion attaches identity / structure to ordinary markdown via HTML comments
// (e.g. <!--lotion-comment:abcd1234-->) and lang-tagged code fences (e.g.
// ```lotion-db). Centralising the prefix strings here prevents drift between
// the writer (a feature module) and the reader (regex.ts, codelenses, etc.)
// when a marker name changes.
//
// New marker types should land here first, and consumers should derive their
// regex patterns or write strings from these constants.

export const Markers = {
  /** HTML-comment marker prefixes. The full marker shape is `<!--<prefix>:<id>-->` (or just `<!--<prefix>-->` when there's no id). */
  commentPrefix: "lotion-comment",
  processorPrefix: "lotion-processor",
  lockPrefix: "lotion-lock",
  secretboxBarePrefix: "lotion-secretbox",

  /** Code-fence language tags. Used inside ` ```<tag> ` fences. */
  dbFenceLang: "lotion-db",
  dbViewsFenceLang: "lotion-db-views",

  /** Inline HTML-comment markers (no payload). */
  secretboxMarkerHtml: "<!--lotion-secretbox-->",
} as const;

export type MarkerKey = keyof typeof Markers;
