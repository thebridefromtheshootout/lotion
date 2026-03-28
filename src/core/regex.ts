// ── Regex registry ──────────────────────────────────────────────────
// Centralized regular expressions used across modules.

export const Regex = {
  // Common helpers
  lineIndent: /^(\s*)/,
  windowsSlash: /\\/g,
  whitespaceRun: /\s+/g,
  whitespaceRunNoGlobal: /\s+/,
  dashUnderscore: /[-_]/g,
  wordBoundaryChar: /\b\w/g,
  quotedStringEdges: /^["']|["']$/g,
  nonWordSpaceHyphen: /[^\w\s-]/g,
  trimHyphenEdges: /^-+|-+$/g,
  colonDot: /[:.]/g,
  doubleQuote: /"/g,
  singleQuote: /'/g,
  trailingSlash: /\/$/,
  fileExtensionSuffix: /\.\w+$/,
  urlWwwPrefix: /^www\./,
  regexMetaCharsGlobal: /[.*+?^${}()|[\]\\]/g,
  queryOrHashMarker: /[?#]/,
  squareBracketsGlobal: /[\[\]]/g,
  wordOrParenSplit: /[\s()]+/,
  newlineGlobal: /\n/g,
  lineBreakSplit: /\r?\n/,
  lineBreakSplitGlobal: /\r?\n/g,
  wordSplit: /\s+/,
  wordSplitGlobal: /\s+/g,
  tabGlobal: /\t/g,
  commaGlobal: /,/g,

  httpUrl: /^https?:\/\/\S+$/,
  httpSchemePrefix: /^https?:\/\//i,
  httpOrMailtoOrAnchor: /^https?:\/\/|^mailto:|^#/,
  invalidPathChars: /[<>:"/\\|?*]/,

  markdownTableRow: /^\s*\|.*\|\s*$/,
  markdownTableSeparatorRow: /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/,
  markdownLinkGlobal: /\[([^\]]*)\]\(([^)]+)\)/g,
  htmlAnchorTagGlobal: /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>"']+))[^>]*>(.*?)<\/a>/gi,
  markdownLinkTextOnly: /\[([^\]]*)\]/,
  markdownEmptyLinkGlobal: /\[([^\]]+)\]\(\s*\)/g,
  markdownPageLinkLine: /^\[([^\]]+)\]\(([^)]+\.md)\)\s*$/,
  markdownChildIndexLinkGlobal: /\[([^\]]*)\]\((([^/\s)]+)\/index\.md)\)/g,
  markdownImageSimple: /!\[.*?\]\(([^)]+)\)/,
  markdownImageGlobal: /!\[([^\]]*)\]\(([^)]+)\)/g,
  rsrcPathGlobal: /\.rsrc\/([^\s)]+)/g,
  trailingIndexMd: /\/index\.md$/,

  fencedCodeDelimiter: /^\s*(```|~~~)/,
  fencedBackticksOnly: /^```/,
  fencedCodeBlockGlobal: /```[\s\S]*?```/g,
  backtick: /`/g,
  inlineCodeSimpleGlobal: /`[^`]+`/g,
  inlineCodeNoNewlineGlobal: /`([^`\n]+)`/g,

  listItem: /^(\s*)(?:[-*+]\s+|\d+[.)]\s+|-\s+\[[ xX]\]\s+)/,
  emptyListItem: /^(\s*)(?:\d+[.)]|[-*+]|-\s+\[[ xX]\])\s*$/,
  orderedListItem: /^(\s*)(\d+)([.)]\s)/,
  orderedListMarkerOnly: /^(\s*)(\d+)([.)]\s)$/,
  orderedListDotOnly: /^(\s*)(\d+)(\.)\s/,
  orderedListPrefix: /^(\s*)(\d+)([.)]) /,
  unorderedListPrefix: /^(\s*)([-*+]) (.*)$/,
  unorderedListSimple: /^(\s*)([-*+]) /,
  unorderedListWithContent: /^(\s*[-*+]\s?)(.*)$/,
  orderedListWithContent: /^(\s*)(\d+)([.)]\s?)(.*)$/,
  blockquotePrefixWithContent: /^(\s*(?:>\s*)+)(.*)$/,
  checkboxWithContent: /^(\s*- \[[ x]\] )(.*)$/,
  anyListPrefix: /^(\s*)([-*+] \[[ x]\] |[-*+] |\d+[.)] )/,
  plainUnorderedList: /^(\s*)[-*+] (?!\[[ x]\])/,
  checkboxListPrefix: /^(\s*[-*+]\s)/,
  checkboxListAnyPrefix: /^(\s*)[-*+] \[[ x]\] /,
  checkboxCheckedLine: /^(\s*[-*+]\s)\[x\]/i,
  checkboxUncheckedLine: /^(\s*[-*+]\s)\[ \]/,
  checkboxTaskDoneLine: /^\s*[-*+] \[x\]/i,
  checkboxTaskPendingGlobal: /^\s*[-*+] \[ \]/gm,
  checkboxTaskDoneGlobal: /^\s*[-*+] \[x\]/gim,

  headingPrefix: /^(#{1,6})\s/,
  headingAnyLevelWithText: /^(#+)\s+(.+)/,
  headingAnyLevelPrefix: /^(#+)\s/,
  headingAnyLevelTitleOnly: /^#+\s+(.+)/,
  headingLineWithText: /^(#{1,6})\s+(.+)$/,
  headingAnyLineGlobalMultiline: /^(#{1,6})\s+.+$/gm,
  headingH1Multiline: /^#\s+(.+)$/m,
  headingH1Global: /^#\s+(.+)$/gm,
  headingH2Global: /^##\s+(.+)$/gm,
  headingH3Global: /^###\s+(.+)$/gm,
  headingH4Global: /^####\s+(.+)$/gm,
  headingH5Global: /^#####\s+(.+)$/gm,
  headingH6Global: /^######\s+(.+)$/gm,
  headingDropOneHash: /^#/,

  // Markdown callouts and highlights
  calloutOpen: /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i,
  calloutTokenWithText: /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)/i,
  calloutTokenStrip: /^\[!\w+\]\s*/,
  calloutContinuation: /^>(.*)/,
  calloutStripPrefixGlobal: /^>\s?/gm,
  blockquoteBlockGlobal: /^(?:>\s?.+(?:\r?\n|$))+/gm,
  highlightDelimitedGlobal: /==[^=\n]+?==/g,

  // Lock / secretbox
  lockMarker: /^<!--lotion-lock:([A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+)-->$/,
  secretboxTagLine: /^\s*<details>\s*<!--lotion-secretbox-->/i,

  // Comments
  commentMarker: /<!--lotion-comment:([a-z0-9]+)-->/,
  commentMarkerGlobal: /<!--lotion-comment:([a-z0-9]+)-->/g,

  // Frontmatter
  frontmatterBlock: /^---\r?\n([\s\S]*?)\r?\n---/,
  frontmatterBlockWithTrailingNewline: /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
  frontmatterKeyValue: /^([^:]+):\s*(.*)/,
  frontmatterTitleLine: /^title:\s*(.+)$/m,
  iconFrontmatterLine: /^icon:\s*(.+)\s*$/m,

  // Footnotes
  footnoteRefGlobal: /\[\^(\d+)\]/g,

  // Link conversion
  inlineLinkUseGlobal: /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g,
  refLinkUseGlobal: /(?<!!)\[([^\]]+)\]\[([^\]]+)\]/g,
  refLinkDefinitionGlobalMultiline: /^\[([^\]]+)\]:\s+(.+)$/gm,

  // Tag index
  frontmatterTagsLine: /^tags:\s*\[([^\]]*)\]/m,
  inlineTagGlobal: /(?:^|\s)#([a-zA-Z][\w-]*)/g,

  // Turn-into / toggle heading
  toggleHeadingOpen: /^<details(\s+open)?>$/,
  toggleHeadingSummary: /^<summary><h([1-6])>(.+)<\/h[1-6]><\/summary>$/,

  // Database schema/views
  dbSchemaFenceStart: /^```lotion-db\s*$/,
  dbSchemaFenceStartMultiline: /^```lotion-db\s*$/m,
  dbViewsFenceStart: /^```lotion-db-views\s*$/,
  dbFenceEnd: /^```\s*$/,
  dbColumnsLine: /^columns:\s*$/,
  dbTitleFieldLine: /^titleField:\s*(.+)$/,
  dbDashNameLine: /^\s+-\s+name:\s*(.+)$/,
  dbTypeLine: /^\s+type:\s*(.+)$/,
  dbOptionsLine: /^\s+options:\s*\[(.+)\]$/,
  dbMaxWidthLine: /^\s+maxWidth:\s*(\d+)$/,
  dbMaxHeightLine: /^\s+maxHeight:\s*(\d+)$/,
  dbViewsLine: /^views:\s*$/,
  dbDefaultLine: /^\s+default:\s*(true|false)$/,
  dbSortColLine: /^\s+sortCol:\s*(.+)$/,
  dbSortDirLine: /^\s+sortDir:\s*(asc|desc)$/,
  dbLayoutLine: /^\s+layout:\s*(table|kanban|calendar|graph|map)$/,
  dbKanbanGroupLine: /^\s+kanbanGroupCol:\s*(.+)$/,
  dbCalendarDateLine: /^\s+calendarDateCol:\s*(.+)$/,
  dbCalendarEndDateLine: /^\s+calendarEndDateCol:\s*(.+)$/,
  dbFiltersLine: /^\s+filters:\s*$/,
  dbFilterColLine: /^\s+-\s+col:\s*(.+)$/,
  dbFilterOpLine: /^\s+op:\s*(.+)$/,
  dbFilterValueLine: /^\s+value:\s*(.+)$/,

  // Database property tables
  propertyTableHeader: /^\|\s*Property\s*\|\s*Value\s*\|/i,
  propertyTableSeparator: /^\|[\s-]+\|[\s-]+\|$/,
  escapedPipe: /\\\|/g,
  plainPipe: /\|/g,

  // Dates
  datePatterns: [
    /\b\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?\b/g, // YYYY-MM-DD [HH:mm]
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // MM/DD/YYYY or DD/MM/YYYY
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, // MMMM D, YYYY
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g, // D MMMM YYYY
    /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g, // ddd, MMMM D, YYYY
  ],

  // Processor markers
  processorMarkerGlobal: /<!--\s*lotion-processor:\s*([0-9a-f-]+)\s*-->/g,
  processorStart: /^<!--\s*lotion-processor:\s*([0-9a-f-]+)\s*-->$/,
  processorDetailsOpen: /^<details[^>]*>\s*$/,
  processorSummaryOpen: /^<summary>/,
  processorSummaryClose: /<\/summary>\s*$/,
  processorDetailsClose: /^<\/details>\s*$/,

  // Snippets
  trailingNonWhitespaceWord: /(\S+)$/,
  snippetsSection: /^snippets:\s*\n((?:\s+\S.*\n?)*)/m,
  snippetLineKeyValue: /^\s+(\S+):\s*(.+)$/,
  snippetVarDate: /\$\(date\)/g,
  snippetVarTime: /\$\(time\)/g,
  snippetVarFile: /\$\(file\)/g,
  snippetTabstop: /\$\d/,

  // Slug / date validators
  slugUnsafeChars: /[^a-z0-9-]/g,
  isoDateYmd: /^\d{4}-\d{2}-\d{2}$/,
  dateTokenSingleD: /\bD\b/,

  // HTML / markdown cleanup
  htmlTagGlobal: /<[^>]+>/g,
  htmlEmptyParagraphGlobal: /<p>\s*<\/p>/g,
  htmlListItemsGroupGlobal: /((?:<li>.*<\/li>\s*)+)/g,
  htmlOrderedItemsGroupGlobal: /((?:<oli>.*<\/oli>\s*)+)/g,
  htmlOliTagGlobal: /<\/?oli>/g,
  htmlRelativeSrcAttrGlobal: /src="(?!https?:\/\/|data:)([^"]+)"/g,
  htmlEscapeAmp: /&/g,
  htmlEscapeLt: /</g,
  htmlEscapeGt: />/g,
  htmlEscapeQuote: /"/g,

  // Markdown transforms
  markdownTableBlockGlobal: /^(\|.+\|)\r?\n(\|[-| :]+\|)\r?\n((?:\|.+\|\r?\n?)+)/gm,
  markdownFenceWithLangGlobal: /^```(\w*)\r?\n([\s\S]*?)^```\s*$/gm,
  markdownHorizontalRuleGlobal: /^---+\s*$/gm,
  markdownTaskDoneGlobal: /^- \[x\]\s+(.+)$/gim,
  markdownTaskTodoGlobal: /^- \[ \]\s+(.+)$/gm,
  markdownBulletLineGlobal: /^[-*+]\s+(.+)$/gm,
  markdownOrderedLineGlobal: /^\d+\.\s+(.+)$/gm,
  markdownBoldItalicGlobal: /\*\*\*(.+?)\*\*\*/g,
  markdownBoldGlobal: /\*\*(.+?)\*\*/g,
  markdownItalicGlobal: /\*(.+?)\*/g,
  markdownStrikeGlobal: /~~(.+?)~~/g,
  markdownHighlightGlobal: /==(.+?)==/g,
  markdownLooseParagraphGlobal: /^(?!<[a-z/])((?:.(?!<[a-z/]))+.?)$/gm,

  // Graph / details
  detailsOpenLine: /^\s*<details/i,
  detailsCloseLine: /^\s*<\/details>/i,
  dotFenceOpenLine: /^\s*```dot\s*$/i,
  anyFenceCloseLine: /^\s*```\s*$/,
  summaryTagOpen: /<summary>/i,
  summaryTagClose: /<\/summary>/i,
  summaryTagInline: /<summary>(.*?)<\/summary>/i,
  summaryTagStartCapture: /<summary>(.*)/i,
  lockIconPrefix: /^🔒\s*/,
  guidTemplateSlots: /[xy]/g,

  // Clipboard probes
  clipboardDarwinImageTypes: /«class PNGf»|«class TIFF»|public\.png|public\.tiff/,
  clipboardLinuxImageTypes: /image\/png|image\/jpeg|image\/bmp/,

  // Date parsing (webview)
  dateIsoLoose: /^(\d{4})-(\d{1,2})-(\d{1,2})/,
  dateIsoStrict: /^(\d{4})-(\d{2})-(\d{2})/,
  dateSlashMdy: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
} as const;
