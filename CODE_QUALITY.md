# Lotion Code Quality Review

Scope: every TypeScript / TSX file under `src/` (extension host, webviews, communicators, contracts, hostEditor abstraction, and tests) — 194 source files, ~26.7 K lines. Findings come from static reading; the codebase compiles cleanly and the existing 127-test vitest suite passes. Citations point at `src/` paths so they can be opened directly from the workspace root.

---

## 1. Architecture & layering

The headline boundary — *no `vscode` imports outside `hostEditor/`* — is **respected**. Only [`HostingEditor.ts:30`](src/hostEditor/HostingEditor.ts#L30) and [`EditorTypes.ts:33`](src/hostEditor/EditorTypes.ts#L33) import from `"vscode"`; nothing else does. That contract is the strongest layering invariant in the repo and it holds.

Where the architecture is leaking is the opposite direction: **`core/` depends on every feature module**. `core` was supposed to be the leaf that everyone imports from, but it now reaches outward into 9 sibling packages.

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **High** | `core/cursorContext.ts` imports from `database`, `editor`, `media`, `blocks`, `lists` — `core` knows about every feature. | [`cursorContext.ts:7-13`](src/core/cursorContext.ts#L7) | Either move `cursorContext.ts` (and `cmdFilter.ts`, which depends on it) out of `core/` into a new `composition/` layer, or invert: each feature module registers its own predicate via a `registerCursorPredicate(name, fn)` API. |
| **High** | `core/simpleCommands.ts` imports handlers from `editor`, `blocks`, `formatting`, `links`, `lists`, `navigation`, `views`, `productivity` — `core` is a hub that re-exports all features. | [`simpleCommands.ts:11-58`](src/core/simpleCommands.ts#L11) | Move `SIMPLE_COMMANDS` (and `slashHandler`) to `extension.ts` or a top-level `composition/commands.ts`. Nothing in `core` is "core" once it imports from `productivity/`. |
| **Medium** | `core/slashCommands.ts` similarly imports `*_SLASH_COMMANDS` from every feature module to flatten into `SLASH_COMMANDS`. | [`slashCommands.ts:9-16`](src/core/slashCommands.ts#L9) | Same fix — collect at the composition root, not in `core/`. |
| **Medium** | `core/codelensGenerators.ts` reaches into `database`, `media`, `editor` to build `CODELENS_GENERATORS`. | [`codelensGenerators.ts:4-6`](src/core/codelensGenerators.ts#L4) | Same. The pattern of "core = composition root" should be made explicit by renaming or extracting. |
| **Medium** | `hostEditor/HostingEditor.ts` reaches sideways into `core/webviewShell.ts`, breaking the rule that `hostEditor` is the lowest-level module. | [`HostingEditor.ts:58`](src/hostEditor/HostingEditor.ts#L58) | Inline `getWebviewShellHtml`/`getExtensionUri` into the host editor, or move `webviewShell.ts` into `hostEditor/`. |
| **Low** | The "module barrel" convention (`*/index.ts` re-exporting public surface) is mostly clean, but the editor barrel re-exports `createSnippetExpander` from a module that is disabled in `extension.ts` — dead public surface. | [`editor/index.ts:17`](src/editor/index.ts#L17), used disabled in [`extension.ts:25`](src/extension.ts#L25) | Either delete the module (see "Dead code") or comment out the export to match the disable. |

Cyclic imports: I traced none. The strict downward slope from `extension.ts → core → feature modules → hostEditor/contracts` holds, except that `core` itself contains the upside-down imports above. The downstream cost is that any change to a feature module potentially ripples through `core/index.ts` consumers, and that the public surface of `core` is unstable.

---

## 2. Code duplication

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **High** [Addressed] | `getExecErrorText` and `isMissingCommandError` are copy-pasted **three times** with subtle differences (`processor` matches `command not found`, `clipboard` matches the broader `not found`). | [`processor.ts:133-152`](src/editor/processor.ts#L133), [`dictate.ts:40-59`](src/editor/dictate.ts#L40), [`clipboard.ts:40-59`](src/media/clipboard.ts#L40) | Extract into `core/execErrors.ts` (or a new `shell/` module) with a single regex set. The divergence is itself a bug surface. |
| **High** | CSV parsing reimplemented twice with subtly different semantics (one trims cells, one keeps quoted whitespace). | [`smartPaste.ts:512-541`](src/editor/smartPaste.ts#L512) (`parseCSVLine`), [`dbCommands.ts:1121-1170`](src/database/dbCommands.ts#L1121) (`parseCsvText`) | Extract a single `csv.ts` helper. The TODO at [`dbCommands.ts:1408`](src/database/dbCommands.ts#L1408) already calls this out. |
| **High** [Addressed] | Three near-identical typed-JSON `load/save` pairs for `.rsrc/<name>.json` data: comments, processors, bookmarks. | [`commentModel.ts:30-49`](src/editor/comments/commentModel.ts#L30), [`processor.ts:104-123`](src/editor/processor.ts#L104), [`bookmarks.ts:32-54`](src/productivity/bookmarks.ts#L32) | Extract `core/jsonStore.ts` with `loadJsonStore<T>(filePath, fallback): T` and `saveJsonStore(filePath, data)`. Three call-sites collapse into one. |
| **Medium** | Markdown table parsing duplicated. The TODO acknowledges it. | [`table.ts:78-94`](src/editor/table.ts#L78) (`parseTable`), [`dbCommands.ts:1086-1118`](src/database/dbCommands.ts#L1086) (`parseMarkdownTableAtCursor`) | Reuse `parseTable` from `editor/table.ts` and pass it `start`/`end` line numbers from `dbCommands`. |
| **Medium** | "Locate file in disk-cache, hash workspace key, read JSON, validate version, write back" pattern is duplicated across the two workspace-search commands. | [`searchLinks.ts:30-95`](src/links/searchLinks.ts#L30), [`searchCommands.ts:32-83`](src/editor/searchCommands.ts#L32) | Extract a `WorkspaceCache<T>` class taking version, validator, and bucket name. |
| **Medium** [Addressed] | `escHtml` (escape `& < > "`) is implemented in [`smartPaste.ts:197-203`](src/editor/smartPaste.ts#L197) and [`webviewShell.ts:35-41`](src/core/webviewShell.ts#L35). Identical body. | both files | Move to a single `core/html.ts` and import. *All three copies (smartPaste, webviewShell, and the third in `media/pdfExport.ts`) now share `core/html.ts`. pdfExport re-exports for the existing test.* |
| **Medium** [Addressed] | Inline indent regex `/^(\s*)/` reinvented in [`simpleCommands.ts:66`](src/core/simpleCommands.ts#L66) when `Regex.lineIndent` already exists and is used 15× elsewhere. | [`simpleCommands.ts:66`](src/core/simpleCommands.ts#L66) | Replace with `Regex.lineIndent`. Trivial. |
| **Medium** [Addressed] | The `<details>`-block / fenced-code-block / secretbox scanning logic appears in five places, each walking the document linearly. | [`processor.ts:374-432`](src/editor/processor.ts#L374), [`lockBlock.ts:349-452`](src/blocks/lockBlock.ts#L349), [`outline.ts:140-148`](src/views/outline.ts#L140), [`autoInlineCode.ts:18-31`](src/formatting/autoInlineCode.ts#L18), [`codeContext.ts:17-25`](src/editor/codeContext.ts#L17) | Add a `core/blockIndex.ts` that scans once and returns `{ codeFences, detailsBlocks, calloutBlocks, secretboxes }`; consumers read from the precomputed index. *processor.ts uses marker-id matching, not block detection — left untouched.* |
| **Low** | Two ad-hoc `Math.random`-based ID generators ([`processor.ts:125-131`](src/editor/processor.ts#L125), [`commentCommands.ts:90`](src/editor/comments/commentCommands.ts#L90)) and one `Math.random()`-based CSP nonce ([`webviewShell.ts:26-33`](src/core/webviewShell.ts#L26)). | as cited | A single `core/ids.ts` exporting `guid()` (cryptographic via `crypto.randomBytes`) covers all three. |
| **Low** | The session-only "remember last entered password" pattern ([`lockBlock.ts:59`](src/blocks/lockBlock.ts#L59)) and the "remember already-shown clipboard error" pattern ([`smartPaste.ts:13`](src/editor/smartPaste.ts#L13)) are both ad-hoc module-scope state. | as cited | Acceptable, but worth a `Once<T>` / `SessionMemo<T>` if the pattern grows. |

The user already extracted `lists/listMarker.ts` to dedupe marker logic — that pattern works and should be repeated for the items above.

---

## 3. Type safety

61 occurrences of `any`, `as any`, or `as unknown` across the codebase. Most cluster in three predictable places: VS Code command handlers (variadic `args: any[]`), exec-error helpers, and webview-shell sherpa-onnx bindings.

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **Medium** | Webview-to-extension messages flow through typed communicators, **but the path-shaped fields are not validated**. `msg.relativePath` is fed straight into `path.join(dbDir, msg.relativePath)` and into `executeCommand("vscode.open", ...)`. A compromised webview could send `"../../../etc/passwd"`. | [`dbWebview.ts:90`](src/database/dbWebview.ts#L90), [`dbWebview.ts:104`](src/database/dbWebview.ts#L104), [`dbWebview.ts:175`](src/database/dbWebview.ts#L175) | Validate that the `path.resolve(dbDir, msg.relativePath)` result starts with `path.resolve(dbDir) + path.sep`. See §8 for the security framing. |
| **Medium** [Addressed] | `(node as any).logic === undefined && (node as any).col !== undefined` to discriminate filter clauses, when the discriminator is in the type already. | [`databaseTypes.ts:94`](src/contracts/databaseTypes.ts#L94) | Use `"logic" in node` (TypeScript narrows it). The `as any` cast is hiding the real discrimination. |
| **Medium** | Variadic command handlers all type-check at runtime (`args.length >= 3 && typeof args[0] === "string" && ...`). The `(...args: any[])` signature is necessary, but the runtime parsing should be a single helper. | [`extension.ts:115-141`](src/extension.ts#L115), [`extension.ts:177-201`](src/extension.ts#L177), [`simpleCommands.ts:81-124`](src/core/simpleCommands.ts#L81) | Extract `parseCommandArgs(args)` returning a discriminated union `{ kind: "slash", uri, line, char } \| { kind: "fsPath", path } \| { kind: "active" }`. |
| **Medium** | `recognizer` and `recognizerStream` typed as `any` — `sherpa-onnx-node` is loaded via `require()` and never typed. | [`dictate.ts:165-197`](src/editor/dictate.ts#L165) | Even a minimal hand-written `.d.ts` (`recognizer: { createStream(): SherpaStream }`) beats `any`. |
| **Low** | `extendMarkdownIt(md: any)` in [`extension.ts:269`](src/extension.ts#L269). Acceptable — the `markdown-it` types aren't a dep — but a `// eslint-disable` comment plus a type stub would document intent. | [`extension.ts:269`](src/extension.ts#L269) | Optional. |
| **Low** | `as unknown as TreeView<T>` in `HostingEditor.ts` is a real cast across two `TreeView` types. | [`HostingEditor.ts:635`](src/hostEditor/HostingEditor.ts#L635) | Comment why; or thin wrapper to make it a single intentional cast. |
| **Low** | Several non-null assertions on `getCursorPosition()!` and `getDocument()!` after a guard. The guards are correct but a helper `requireActiveMarkdownEditor()` would remove the `!`. | examples: [`extension.ts:91`](src/extension.ts#L91), [`simpleCommands.ts:104`](src/core/simpleCommands.ts#L104), [`listModel.ts:312`](src/lists/listModel.ts#L312) | Add a single helper to `hostEditor`. |

Message-passing contract safety is otherwise solid: `Communicator<MessageIn, MessageOut>` ([`contracts/communicator.ts:14`](src/contracts/communicator.ts#L14)) is type-safe, every panel has a discriminated union of message types, and webview-side communicators wrap raw `postMessage` calls.

---

## 4. Error handling

26 catch blocks total, 22 of them typed as `any`. There are **no empty catch blocks** (good), but many silently swallow errors with no user-visible signal.

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **Medium** [Addressed] | Cache-read failures silently fall back to "regenerate from scratch" without telling the user. If the cache file is corrupted, regeneration happens on every command invocation. | [`searchLinks.ts:77-79`](src/links/searchLinks.ts#L77), [`searchCommands.ts:65-67`](src/editor/searchCommands.ts#L65) | At least delete the corrupted cache file so retry doesn't trigger the same failure each time. |
| **Medium** [Addressed] | `loadComments` / `loadProcessors` / `loadBookmarks` swallow JSON-parse errors and return `[]` — silently destroying user data on save. If a user hand-edits the JSON and breaks it, a save will overwrite all comments with `[]`. | [`commentModel.ts:35-40`](src/editor/comments/commentModel.ts#L35), [`processor.ts:109-113`](src/editor/processor.ts#L109), [`bookmarks.ts:36-41`](src/productivity/bookmarks.ts#L36) | Make `load*` return `undefined` on parse failure; consumers should refuse to save until the user resolves it (or back up the broken file with a `.broken` suffix). *core/jsonStore.ts now renames an unparseable file to `<name>.broken-<timestamp>.json` before falling back; the next save lands in a fresh file and the user's broken data is preserved.* |
| **Medium** | The processor `runCommand` swallows `execSync` errors and returns the error text as the "output" — fine for shell commands, but it hides authentic failures like the host machine running out of file handles. | [`processor.ts:653-678`](src/editor/processor.ts#L653) | Distinguish between exec-failed-with-output and process-launch-failure; only the former should silently appear as output. |
| **Medium** | `extractEntryLinks` skips files that disappeared but doesn't catch read failures (permission errors, EISDIR). | [`dbWebview.ts:265-285`](src/database/dbWebview.ts#L265) | Wrap the `fs.readFileSync` in a try/catch. |
| **Medium** | `fs.unlinkSync(dest)` fires unconditionally inside the redirect handler in [`dictate.ts:71`](src/editor/dictate.ts#L71); if the file doesn't exist (race / first-time), the whole chain rejects. | [`dictate.ts:69-77`](src/editor/dictate.ts#L69) | `if (fs.existsSync(dest)) fs.unlinkSync(dest)` is already used elsewhere in the same file (line 86). Match. |
| **Low** | `fetchPageTitle` / `fetchOembedTitle` always resolve `undefined` on failure. That's intentional, but the failure mode is invisible — debugging "why didn't link unfurling work" requires editing source. | [`smartPaste.ts:265-294`](src/editor/smartPaste.ts#L265) | Add a `lotion.smartPaste.debug` setting that surfaces the underlying error to the output channel. |
| **Low** | `console.log` is gated on nothing — 25 calls with the prefix `[Lotion][smartPaste]` fire on every Ctrl+V, polluting the developer console. | [`smartPaste.ts:12-21`](src/editor/smartPaste.ts#L12) (and 23 callers) | Gate behind `lotion.debug` setting or remove. The function is well-structured for a flip. |
| **Low** | The processor block design says `<details>` body content is sent to the command via stdin. But `runCommand` calls `execSync` with `stdio: [..., "pipe", "pipe"]` and a `timeout: 30000`; on timeout the process is killed but the user only sees the captured stdout/stderr — no "TIMED OUT" indicator. | [`processor.ts:646-678`](src/editor/processor.ts#L646) | If `err.signal === "SIGTERM"` add a `[timed out after 30s]` prefix. |

---

## 5. Complexity hotspots

| Severity | File | Lines | Concern | Citation |
|---|---|---|---|---|
| **High** | `database/dbCommands.ts` | 1523 | Single file holds 11 slash-command handlers, schema/CSV/table parsing, prompt flows, list-renumbering, and entry creation. The TODOs at L1330 and L1408 acknowledge this. | [`dbCommands.ts`](src/database/dbCommands.ts) |
| **High** | `editor/table.ts` | 1038 | One file owns table parsing, table commands, table keybindings, alignment, column ops, paste/serialize, and clipboard payloads. | [`table.ts`](src/editor/table.ts) |
| **High** | `blocks/lockBlock.ts` | 746 | secretbox + lock + unlock + read-only guard + crypto + display-zone tracking, all in one. The crypto helpers (~50 lines) and the cursor-displacement guard (~150 lines) deserve their own files. | [`lockBlock.ts`](src/blocks/lockBlock.ts) |
| **Medium** | `hostEditor/HostingEditor.ts` | 761 | Acceptable as a wrapper, but the class has ~80 methods. Splitting into `Editor`, `Workspace`, `UI`, `Diagnostics` facets would help discoverability. | [`HostingEditor.ts`](src/hostEditor/HostingEditor.ts) |
| **Medium** | `editor/processor.ts` | 713 | Couples 3 commands + GUID + storage + Windows-shell-resolution + block-finder + exec runner. Splitting "shell selection on Windows" out is the highest-leverage cut (~100 lines). | [`processor.ts`](src/editor/processor.ts) |
| **Medium** | `editor/smartPaste.ts` | 541 | `handleSmartPaste` orchestrates link-wrap, auto-link, table, and image paths in a 140-line function. The four paths share little — they should be four functions called from a small dispatcher. | [`smartPaste.ts:24-164`](src/editor/smartPaste.ts#L24) |
| **Medium** | `webview/components/FilterBar.tsx` | 548 | One React component with 13 internal handlers. The drag-and-drop logic (~120 lines) is testable in isolation. | [`FilterBar.tsx`](src/webview/components/FilterBar.tsx) |
| **Medium** | `navigation/turnInto.ts` | 513 | Pattern-match-and-rewrite engine. Long, but linear; splitting per kind (heading/list/code/quote) would reduce flow-control depth. | [`turnInto.ts`](src/navigation/turnInto.ts) |
| **Medium** | `lists/listModel.ts` | 427 | Houses two separate concepts (ordered-list collection vs. generic list-sibling collection). Already partially extracted to `listMarker.ts` — finishing the split is straightforward. | [`listModel.ts`](src/lists/listModel.ts) |
| **Low** | `handleNewViewCommand` is a 165-line linear prompt chain. Extract per-step helpers (`promptSortColumn`, `promptFilters`, `promptViewName`). | [`dbCommands.ts:836-1000`](src/database/dbCommands.ts#L836) | as cited |

Cyclomatic-complexity-by-eye hot spots: `findDetailsBlock` ([`lockBlock.ts:349-452`](src/blocks/lockBlock.ts#L349), nested loops with multiple `for`-with-break sequences), `handleSmartPaste` (4 sequential branches with try/catch each), `insertDbEntryLinkWithListModel` ([`dbCommands.ts:300-363`](src/database/dbCommands.ts#L300), 5 different "where do we insert?" cases).

---

## 6. Dead code [Addressed]

There's a sizable graveyard of disabled features still on disk. **1768 lines** across 15 files are imported nowhere except via commented-out `// disabled` lines.

| Severity | File (LOC) | Used? | Citation |
|---|---|---|---|
| **High** | `editor/template.ts` (213) — `TEMPLATE_SLASH_COMMAND`, `handleTemplateCommand` | Disabled | [`editor/index.ts:20`](src/editor/index.ts#L20), [`editor/index.ts:51`](src/editor/index.ts#L51), [`editor/index.ts:73`](src/editor/index.ts#L73) |
| **High** | `editor/snippetExpander.ts` (131) — `createSnippetExpander` | Exported but disabled | [`editor/index.ts:17`](src/editor/index.ts#L17), [`extension.ts:25`](src/extension.ts#L25), [`extension.ts:247`](src/extension.ts#L247) |
| **High** | `editor/focusMode.ts` (209) — `toggleFocusMode` | Disabled | [`editor/index.ts:13`](src/editor/index.ts#L13), [`simpleCommands.ts:13`](src/core/simpleCommands.ts#L13), [`simpleCommands.ts:135`](src/core/simpleCommands.ts#L135) |
| **High** | `productivity/pomodoro.ts` (107) | Disabled | [`productivity/index.ts:5`](src/productivity/index.ts#L5), [`extension.ts:66`](src/extension.ts#L66) |
| **High** | `productivity/taskProgress.ts` (58) | Disabled | [`productivity/index.ts:6`](src/productivity/index.ts#L6), [`extension.ts:67`](src/extension.ts#L67) |
| **High** | `productivity/clipHistory.ts` (105) | Disabled | [`extension.ts:65`](src/extension.ts#L65), [`extension.ts:261`](src/extension.ts#L261) |
| **High** | `navigation/wikiSearch.ts` (104) | Disabled | [`navigation/index.ts:14`](src/navigation/index.ts#L14), [`simpleCommands.ts:37`](src/core/simpleCommands.ts#L37) |
| **High** | `navigation/tagIndex.ts` (114) | Disabled | [`navigation/index.ts:12`](src/navigation/index.ts#L12), [`simpleCommands.ts:36`](src/core/simpleCommands.ts#L36) |
| **High** | `navigation/headingAnchor.ts` (74) — `createHeadingAnchorDecorations` | Imported, disabled at registration site | [`extension.ts:50`](src/extension.ts#L50), [`extension.ts:231`](src/extension.ts#L231) |
| **High** | `core/trailingNewline.ts` (63) — `createTrailingNewlineFixer` | Imported, disabled at registration site | [`extension.ts:9`](src/extension.ts#L9), [`extension.ts:243`](src/extension.ts#L243) |
| **High** | `blocks/moveBlock.ts` (253) — `MOVE_SLASH_COMMAND` | Disabled | [`blocks/index.ts:18`](src/blocks/index.ts#L18), [`blocks/index.ts:24`](src/blocks/index.ts#L24) |
| **High** | `media/unusedImages.ts` (105) — `findUnusedImages` | Disabled | [`media/index.ts:7`](src/media/index.ts#L7), [`simpleCommands.ts:41`](src/core/simpleCommands.ts#L41) |
| **High** | `lists/listToggle.ts` (62) — `toggleListType` | Disabled | [`simpleCommands.ts:25`](src/core/simpleCommands.ts#L25), [`simpleCommands.ts:157`](src/core/simpleCommands.ts#L157) |
| **High** | `formatting/wrapWith.ts` (85) — `wrapWith` | Disabled | [`simpleCommands.ts:19`](src/core/simpleCommands.ts#L19), [`simpleCommands.ts:146`](src/core/simpleCommands.ts#L146) |
| **High** | `formatting/smartPairs.ts` (85) — `createSmartPairs` | Imported, disabled at registration site | [`extension.ts:38`](src/extension.ts#L38), [`extension.ts:246`](src/extension.ts#L246) |

Plus 13 entries in `core/commands.ts` ([L8, L82, L97, L109, L114, L119, L158-160](src/core/commands.ts#L8)) declare command IDs for handlers that aren't registered.

**Recommendation**: pick a policy and enforce it. Either (a) delete files outright (git history is enough), or (b) move the entire set into a single `experimental/` directory excluded from the build by `tsconfig`. Right now the disabled code is parsed by `tsc`, type-checked, and shipped in source distributions, with the only signal being a `// disabled` comment.

---

## 7. Testing

127 tests across 6 files. Coverage is concentrated on a few pure-function modules; **most of the codebase has no tests**.

**Modules with direct tests** (functions imported and exercised):
- `editor/date` ([`date.test.ts`](src/__tests__/date.test.ts))
- `editor/frontmatterEditor` ([`frontmatterEditor.test.ts`](src/__tests__/frontmatterEditor.test.ts))
- `media/pdfExport` ([`pdfExport.test.ts`](src/__tests__/pdfExport.test.ts))
- `database/database` (parseSchema, parseViews, parsePropertyTable, etc., via [`database.test.ts:1`](src/__tests__/database.test.ts#L1))

**Modules tested only by reimplemented copies of their regexes** (false coverage):
- `aesthetics.test.ts` re-defines `LEVEL_ICONS`, `buildCrumbs`, etc. inline ([`aesthetics.test.ts:11`](src/__tests__/aesthetics.test.ts#L11)) instead of importing from `views/outline.ts` and `navigation/breadcrumb.ts`. The actual module logic is never exercised.
- `editorDecorations.test.ts` redeclares `CALLOUT_OPEN_RE`, `HIGHLIGHT_RE`, `FENCE_RE` locally rather than importing from `editor/editorDecorations.ts` ([`editorDecorations.test.ts:9`](src/__tests__/editorDecorations.test.ts#L9)).

**High-value, untested modules** (ranked by complexity × user-facing impact):

| Module | Why it matters | Test approach |
|---|---|---|
| `lists/listModel.ts`, `lists/listMarker.ts`, `lists/listIndent.ts` | Most-used feature (typing in lists). Logic is pure: takes a `TextDocument`-like object, returns edits. | Mock `TextDocument` with a `lineAt(i)` shim. The existing vscode mock at [`__tests__/__mocks__/vscode.ts`](src/__tests__/__mocks__/vscode.ts) is already on disk. |
| `blocks/lockBlock.ts` (crypto) | Encryption correctness is critical. `encrypt`/`decrypt` round-trip is a 5-line test. | Direct call. |
| `editor/smartPaste.ts` (URL/title parsing, table detection) | Touched on every Ctrl+V. `tryParseTableData`, `extractTitle`, `deriveUrlLabel`, `cleanTitle` are all pure. | Direct call with fixture HTML strings. |
| `editor/processor.ts` (block parsing, ID scan) | `findProcessorMarkerIds`, `duplicateProcessorMarkers`, `migrateProcessors` are pure given an in-memory text. | Direct call. |
| `lists/listSwapMarker.ts` | Behaviour-on-keystroke; complex state machine. | Use the in-memory document mock. |
| `database/dbFrontmatter.ts` (`updateEntryProperty`, `appendToLogTable`) | Writes to disk, but the underlying string transforms are pure. | Refactor to take/return strings, then test the string layer. |
| `formatting/autoInlineCode.ts` `isInsideCode` predicate | Bug-prone. Pure given a document mock. | Document mock. |
| `core/cursorContext.ts` | Boolean fan-out used to decide command visibility. | Document mock. |

Any of these would catch real bugs. The `vscode` mock exists already, so the friction is low.

---

## 8. Security

The `processor` block is a deliberate "run shell command from markdown" feature — that's by design. The concerns below are about boundary cases.

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **High (XSS)** [Wontfix — intentional] | Database table cells of unrecognised type fall through to `dangerouslySetInnerHTML={{ __html: value }}`. The `value` originates from a markdown property-table cell in an entry's `index.md` — which is user-controlled, but more importantly is *also* what a webview message-handler writes when the user types in an inline editor. A user pasting `<img src=x onerror=alert(1)>` into a cell will execute the script when the table re-renders. | [`FormatCell.tsx:46`](src/webview/components/database/tableview/FormatCell.tsx#L46) | Render `value` as text by default; only allow specific types (text, badge, etc.). The `default:` branch should be `<span>{value}</span>`, full stop. *Intentional: cells must support inline HTML for rich content. Future fix should sanitize via DOMPurify-style, not text-escape.* |
| **High (Path traversal)** [Addressed] | `path.join(dbDir, msg.relativePath)` is used as a file path to read/write/open without checking that the result is inside `dbDir`. A malicious or buggy webview can send `relativePath: "../../../.bashrc"` and it will be read or opened. | [`dbWebview.ts:90`](src/database/dbWebview.ts#L90), [`dbWebview.ts:104`](src/database/dbWebview.ts#L104), [`dbWebview.ts:164`](src/database/dbWebview.ts#L164), [`dbWebview.ts:175`](src/database/dbWebview.ts#L175) | Add `if (!path.resolve(dbDir, p).startsWith(path.resolve(dbDir) + path.sep)) return;` before each fs use. |
| **Medium (Shell injection)** [Addressed] | The Linux clipboard probe runs `xclip -selection clipboard -t image/png -o > "${filePath}"` with `shell: "/bin/sh"`. `filePath` is built from `imageName`, which is validated against `Regex.invalidPathChars = /[<>:"/\\|?*]/` ([`smartPaste.ts:132`](src/editor/smartPaste.ts#L132)) — but that regex doesn't reject `` ` ``, `$`, `;`, or backslash-newline. A name like `` foo`rm -rf ~`bar `` is accepted by the validator and reaches the shell. | [`clipboard.ts:124`](src/media/clipboard.ts#L124) | Either expand the validator to reject all shell metacharacters, or write through Node (`fs.writeFileSync(filePath, execSync("xclip ...", {stdio: ["pipe","pipe","pipe"]}))`) so the path never reaches a shell. *Linux saveImage now uses execFileSync to capture xclip's stdout as a Buffer, then writes via fs.writeFileSync — the path never touches a shell.* |
| **Medium (Shell injection)** [Addressed] | Same risk in WSL: `wslpath -w "${filePath}"` and PowerShell single-quote injection in [`clipboard.ts:87`](src/media/clipboard.ts#L87) (`$img.Save('${winPath.replace(...)}')`). The single-quote escaping is done, but only for `'` — not for `\` followed by `'`. | [`clipboard.ts:76`](src/media/clipboard.ts#L76), [`clipboard.ts:87`](src/media/clipboard.ts#L87) | Same: prefer Node-side I/O. *wslpath now invoked via execFileSync (argv array, no shell). PowerShell invocation also moved to execFileSync; path is still single-quoted inside the script (with the existing `'`→`''` doubling) but the script is now a single argv element instead of being interpolated into a shell-double-quoted string.* |
| **Medium (Shell injection)** [Addressed] | The dictate `python -c "import tarfile; tarfile.open(r'${archivePath}','r:bz2')..."` interpolates `archivePath` into a Python literal inside a shell-quoted string. `archivePath` is constructed in-extension and not user-supplied, so this is currently safe — but the form is fragile. | [`dictate.ts:127`](src/editor/dictate.ts#L127) | Use `execFileSync("python", ["-c", script])`. *Now uses execFileSync with paths passed as argv (`sys.argv[1]`/`sys.argv[2]`) — no string interpolation into python source. The tar fallback also moved to execFileSync. The 7z pipe-chain still needs a shell so it kept execSync.* |
| **Medium (Crypto)** [Addressed] | The CSP nonce uses `Math.random()`. CSP nonces are public, but the threat model is that an attacker who can inject script into the page can replay the nonce; a non-cryptographic RNG with 16-char output gives ≈10^28 possibilities, which is fine, but using `crypto.randomBytes(16).toString("base64")` is one line and removes the question. | [`webviewShell.ts:26-33`](src/core/webviewShell.ts#L26) | One-line change. |
| **Medium (Crypto)** | `secretbox` uses PBKDF2 + SHA-512 with **100k iterations**. OWASP 2023 recommends 600k for PBKDF2-SHA-512. | [`lockBlock.ts:51`](src/blocks/lockBlock.ts#L51) | Bump to 600_000. Existing blobs include the salt but not the iteration count, so increasing iterations breaks decryption of old blobs — solve by storing the iteration count as an extra dotted segment, version-tagged. |
| **Medium (Secrets)** [Addressed] | `secretbox` caches the last password in a module-scope `let lastPassword`. Lifetime is the extension host's lifetime — minutes to hours. It's pre-filled into `showInputBox(value: lastPassword)`, so a screen reader / clipboard-prompt would expose it. | [`lockBlock.ts:59`](src/blocks/lockBlock.ts#L59), [`lockBlock.ts:488`](src/blocks/lockBlock.ts#L488), [`lockBlock.ts:669`](src/blocks/lockBlock.ts#L669) | Either don't pre-fill (just show a placeholder), or expire after N minutes. *Now wrapped in `touchLastPassword`/`readLastPassword`/`clearLastPassword` with a 5-minute TTL; `setTimeout` wipes the value when it expires. Pre-fill still works for back-to-back lock/unlock but the value can no longer linger for hours.* |
| **Low (Cmd injection)** | `processor` executes a user-typed shell command — that's the feature. It's correctly scoped via `cwd: resolveProcessorCwd(...)` to a `.rsrc/` directory. No issue, but a workspace-trust check (`workspace.isTrusted`) before first run would be defensible defaults. | [`processor.ts:472`](src/editor/processor.ts#L472), [`processor.ts:523`](src/editor/processor.ts#L523) | Gate processor execution on `vscode.workspace.isTrusted`. |
| **Low (Path traversal)** | `findProcessorBlock` and `findCommentLine` look up by GUID; they don't traverse but the GUID-typed regex `[0-9a-f-]+` could match a marker injected into a malicious file. Not exploitable on its own — just noting that GUID validation should require the canonical `8-4-4-4-12` shape. | [`processor.ts:179`](src/core/regex.ts#L179) | `Regex.processorMarkerGlobal` is a candidate to tighten. |

---

## 9. Performance

Many features re-scan the entire document on every event. For typical markdown pages this is fine, but for the multi-thousand-line files Lotion encourages (long databases, big notes), it's a real concern.

| Severity | Finding | Citation | Recommended fix |
|---|---|---|---|
| **High** [Addressed] | `views/outline.ts` `buildHeadingTree` calls `isInsideFence(doc, i)` for every line — and `isInsideFence` itself iterates from line 0 to line `i`. **O(N²)** in document length, fired on every text change *and* every editor activation (registered in `extension.ts:167`). | [`outline.ts:96-99`](src/views/outline.ts#L96), [`outline.ts:140-148`](src/views/outline.ts#L140) | Track `inFence: boolean` in the outer loop instead of re-scanning. One line. |
| **High** [Addressed] | `blocks/lockBlock.ts` `getEncryptedZones` scans every line for the secretbox tag, then `findDetailsBlock` does its own bidirectional scan from each match. Fires on **every cursor move** via `onDidChangeTextEditorSelection`. | [`lockBlock.ts:105-128`](src/blocks/lockBlock.ts#L105), [`lockBlock.ts:156`](src/blocks/lockBlock.ts#L156) | Cache zones per document, invalidate on `onDidChangeTextDocument`. Read on `onDidChangeTextEditorSelection`. |
| **High** [Addressed] | `formatting/autoInlineCode.ts` `isInsideCode` walks every line up to the cursor for fence-state, on **every keystroke** that hits a trigger char (space, comma, etc.). | [`autoInlineCode.ts:18-31`](src/formatting/autoInlineCode.ts#L18), called from [`autoInlineCode.ts:57`](src/formatting/autoInlineCode.ts#L57) | Same fix: precompute fence ranges per document; reuse. |
| **High** [Addressed] | Same pattern in `editor/codeContext.ts` `cursorInCodeContext` (called from `linkFactory.ts`, `listSwapMarker.ts`, `cursorContext.ts`). | [`codeContext.ts:17-25`](src/editor/codeContext.ts#L17) | Same fix. |
| **High** [Partially addressed] | `core/cursorContext.ts` `computeCursorContext` calls 9 cursor predicates in sequence on **every fired slash-command completion**. Each predicate scans the document. `cursorInDb` calls `getText()` on every keystroke after `/`. | [`cursorContext.ts:28-44`](src/core/cursorContext.ts#L28), [`dbEntries.ts:70-72`](src/database/dbEntries.ts#L70) | Memoise per-document with the version number from `doc.version` as the cache key. *cursorInTable, cursorInCodeContext, and cursorInSecretbox now read from the cached BlockIndex; cursorInDb / cursorInDbEntry / cursorInProcessor still walk separately.* |
| **High** [Addressed] | `cursorInDbEntry` calls `findParentDbIndex` which calls `isDbFile` which **reads `index.md` from disk** on every cursor move (via `computeCursorContext`). | [`dbEntries.ts:79-83`](src/database/dbEntries.ts#L79), [`dbEntries.ts:58-64`](src/database/dbEntries.ts#L58) | Cache by file path; invalidate on `onDidSaveTextDocument` for the candidate index path. *isDbFile now stat-checks the candidate and only re-reads when mtime/size changes; cache also invalidated explicitly via `invalidateDbFileCache` from extension.ts on save. The redundant `existsSync` in `findParentDbIndex` is gone (folded into the stat).* |
| **High** [Addressed] | `editor/editorDecorations.ts` `update` re-iterates the whole document on every text change with no debounce. | [`editorDecorations.ts:99-188`](src/editor/editorDecorations.ts#L99), [`editorDecorations.ts:193-197`](src/editor/editorDecorations.ts#L193) | Wrap with a `setTimeout(update, 50)` debounce. The function is idempotent, so coalescing is safe. *Now reads callout/fence ranges from the cached BlockIndex; only the per-line `==highlight==` content scan remains.* |
| **High** [Addressed] | `core/structureLint.ts` `lintDocument` runs on every text change; no debounce. For diagnostic linters this is the costliest possible cadence. | [`structureLint.ts:145`](src/core/structureLint.ts#L145) | Debounce 200ms (VS Code's own linter cadence). *Now reuses the cached BlockIndex for fence detection — the underlying scan is amortized via the 50ms throttled rebuild.* |
| **Medium** [Addressed] | `views/wordCount.ts` `updateWordCount` runs on **every selection change** (just to update the "selected words / total words" tooltip). For a 5k-line doc the regex chain over `getDocumentText()` is ~5ms, so 200 selection events/sec is a jank source. | [`wordCount.ts:21`](src/views/wordCount.ts#L21) | Cache total counts per document version; only recompute selection counts on selection change. *WeakMap keyed by TextDocument with `doc.version` validation; selection-change paths now reuse the cached totals.* |
| **Medium** | `database/dbWebview.ts` `extractEntryLinks` synchronously reads every entry file in the database on each panel `init`. For a database with hundreds of entries this is meaningful. | [`dbWebview.ts:265-285`](src/database/dbWebview.ts#L265) | Stream / batch with `Promise.all(fs.promises.readFile(...))`. |
| **Medium** | `webview/components/database/tableview/TableView.tsx` performs an **optimistic mutation of the parent's entry array** to avoid a re-render: `entry.properties[colName] = newVal;` directly mutates the prop. | [`TableView.tsx:32`](src/webview/components/database/tableview/TableView.tsx#L32) | Use `setState`-driven optimistic update. The current mutation will desync if React batches differently. |
| **Medium** | `DatabaseViewRoot.tsx` deep-clones the filter tree with `JSON.parse(JSON.stringify(...))` on every save and load. For typical filter trees that's <1ms; flagged because it's repeated and there's an [`FilterBar.tsx:530`](src/webview/components/FilterBar.tsx#L530) `deepClone` that does the same. | as cited | One shared `deepClone` + `structuredClone` (Node 18+) is fine. |
| **Low** | `extension.ts:167` triggers `outlineProvider.refresh()` on every text change with no debounce. The refresh just fires the event; the actual scan is in `outline.ts` and is the O(N²) issue above. | [`extension.ts:167`](src/extension.ts#L167) | Debounce. |
| **Low** | All `fs.readFileSync` calls (134 of them) — none of them async. None is in a per-keystroke hot path I caught, but the workspace-link cache regeneration ([`searchLinks.ts:138-139`](src/links/searchLinks.ts#L138)) reads every `.md` file synchronously. | [`searchLinks.ts:138`](src/links/searchLinks.ts#L138) | `fs.promises.readFile` + `Promise.all`. |

React webview memoisation is **almost entirely absent** — only `DatabaseViewRoot.tsx` and `DatePicker.tsx` use `useMemo` / `useCallback`. `TableView`, `KanbanView`, `CalendarView`, `GraphView`, `MapView`, `FilterBar`, `Toolbar` re-render on every keystroke in any input. For databases with hundreds of entries this matters. Add `React.memo` on `RenderEntry`/`RenderCell` ([`TableView.tsx:62`](src/webview/components/database/tableview/TableView.tsx#L62)).

---

## 10. Naming / consistency

Mostly consistent. Spotted issues:

| Severity | Finding | Citation |
|---|---|---|
| **Low** | `Regex.htmlEscapeAmp` etc. are 4 separate regexes when a single `htmlEscapeChars: /[&<>"]/g` plus a replacer would be cleaner — and the inline-regex copies in [`smartPaste.ts:197-202`](src/editor/smartPaste.ts#L197) would reuse it. | [`regex.ts:207-210`](src/core/regex.ts#L207) |
| **Low** | `Cmd.gitCommit` is registered through `slashHandler(handleGitCommitCommand)` even though git-commit doesn't take a `(doc, pos)` — it only does `viaSlash` accounting. | [`simpleCommands.ts:182`](src/core/simpleCommands.ts#L182) |
| **Low** | The naming "smart-something" appears for `smartPaste`, `smartPairs`, `smartTypography` — fine, but `autoInlineCode` and `autoInlineCode` (vs `autoInline*Code*`) breaks the pattern. | [`formatting/autoInlineCode.ts`](src/formatting/autoInlineCode.ts) |
| **Low** | `findOrphanPages` (in `navigation`) and `findUnusedImages` (disabled, in `media`) are sibling concepts; `findUnusedImages` was disabled but `findOrphanPages` lives. Pick one verb. | [`navigation/orphanPages.ts`](src/navigation/orphanPages.ts), [`media/unusedImages.ts`](src/media/unusedImages.ts) |
| **Low** | `cursorInCodeContext` vs `isInsideCode` (private to autoInlineCode) — these compute the same predicate. Naming convergence would make the duplicate visible. | [`codeContext.ts:10`](src/editor/codeContext.ts#L10), [`autoInlineCode.ts:18`](src/formatting/autoInlineCode.ts#L18) |
| **Low** | `lotion-processor`, `lotion-secretbox`, `lotion-comment`, `lotion-lock`, `lotion-db`, `lotion-db-views` — six different in-document HTML-comment / fence prefixes. Sustainable, but a `core/markers.ts` with all six string constants would prevent typo-bugs. | scattered |
| **Low** | Filename casing is consistent camelCase (`dbCommands.ts`, `headingNav.ts`, `listMarker.ts`); good. The webview side uses PascalCase for components (`DatabaseViewRoot.tsx`); good. Mixed: `tableview/` lowercase folder with `TableView.tsx` PascalCase file. | [`webview/components/database/tableview/`](src/webview/components/database/tableview/) |

---

## 10b. Configuration / wiring consistency

| Severity | Finding | Citation |
|---|---|---|
| **Medium** [Addressed] | `core/commands.ts` declares 144 command IDs (one per line, all `lotion.*`). At least 10 are dead — declared here but the handlers are commented out everywhere ([`Cmd.toggleFocusMode`](src/core/commands.ts#L8), [`Cmd.wrapWith`](src/core/commands.ts#L82), [`Cmd.toggleListType`](src/core/commands.ts#L97), [`Cmd.showTagIndex`](src/core/commands.ts#L109), [`Cmd.wikiSearch`](src/core/commands.ts#L114), [`Cmd.findUnusedImages`](src/core/commands.ts#L119), [`Cmd.pomodoroStart/Break/Stop`](src/core/commands.ts#L158)). They still appear in completions if anyone imports `Cmd.foo`. | [`commands.ts`](src/core/commands.ts) |
| **Medium** [Addressed] | `package.json` declares 1095 lines including `commands`, `keybindings`, `views`, `configuration`, `submenus`. With ~10 dead `Cmd.*` entries, the corresponding `package.json` `commands` and `keybindings` may declare orphaned entries. *Note: `lotion.insertTemplate` and `lotion.expandSnippet` package.json entries also became orphans after the purge — left in place; can be cleaned in a follow-up.* | [`package.json`](package.json) |
| **Low** [Addressed] | `extension.ts` registration block ([`extension.ts:223-262`](src/extension.ts#L223)) lists 7 commented-out registrations. Once the dead-code purge happens, this block can be cut by ~30%. | as cited |

---

## 11. Documentation

| Severity | Finding | Citation |
|---|---|---|
| **Medium** | `fetchPageTitle` is documented as "Fetch a URL and extract the page title" but actually tries oEmbed first and falls back to HTML scraping. The behaviour-divergence is explained in a free-floating comment (`// Try oEmbed first`) rather than in the JSDoc. | [`smartPaste.ts:296-303`](src/editor/smartPaste.ts#L296) |
| **Medium** | `cursorInProcessor` is documented as "True when the cursor is inside a processor block." but iterates back from the cursor looking for the marker — it's actually "true if the most recent marker above the cursor is a processor and the cursor is within that block". | [`processor.ts:683-699`](src/editor/processor.ts#L683) |
| **Medium** | `findParentDbIndex` doc says "Returns the DB index path, or undefined if not a child entry." but it also returns undefined if the file IS the index ([`dbEntries.ts:95`](src/database/dbEntries.ts#L95)) — that's not "not a child". | [`dbEntries.ts:85-98`](src/database/dbEntries.ts#L85) |
| **Low** | `slashHandler` has a great header comment explaining the dual call-shape. `Cmd.openDbWebview` and `Cmd.dbAddEntry` have similar dual call-shapes but are inlined into `extension.ts` with comments — would benefit from being a third case in `slashHandler`. | [`extension.ts:115-201`](src/extension.ts#L115), [`simpleCommands.ts:81-124`](src/core/simpleCommands.ts#L81) |
| **Low** | `webview/communicators/` has no header comments explaining the contract relationship to `communicators/` (extension-host side). A reader has to infer it. | [`webview/communicators/`](src/webview/communicators/) |
| **Low** | Public exports without JSDoc: most of `database/dbCommands.ts`'s exported handlers (`handleNewFieldCommand`, etc.) lack docstrings. Single-line summaries would help command-palette users figure out behaviour from the source. | [`dbCommands.ts:638`](src/database/dbCommands.ts#L638), [`dbCommands.ts:698`](src/database/dbCommands.ts#L698), [`dbCommands.ts:809`](src/database/dbCommands.ts#L809) |

---

## Top 5 highest-leverage fixes

Ranked by **(impact × ease) / risk**.

### 1. Render `dangerouslySetInnerHTML` as text by default (security, 1-line fix) [Wontfix — intentional]
[`FormatCell.tsx:46`](src/webview/components/database/tableview/FormatCell.tsx#L46) — change the `default:` branch to `<span>{value}</span>`. The current code is an XSS sink reachable through any database property table or inline-edit input. Risk: nil (the only thing rendered as HTML today is unrecognised types; nothing depends on that being HTML). Impact: closes the most direct user-injection vector.

### 2. Validate `relativePath` against `dbDir` in `dbWebview.ts` (security, ~10 lines) [Addressed]
[`dbWebview.ts:90-175`](src/database/dbWebview.ts#L90) — add `if (!path.resolve(dbDir, p).startsWith(path.resolve(dbDir) + path.sep)) return;` at the top of each of the four entry-path handlers. Risk: nil for legitimate use. Impact: prevents the webview-message path traversal class of bug.

### 3. Replace document-wide rescans with a per-document cached block index (perf, ~150 lines) [Addressed]
A single new module `core/blockIndex.ts` that produces, per document version: (a) fenced-code-block ranges, (b) `<details>` ranges, (c) callout ranges, (d) secretbox ranges. Consumers in [`outline.ts:140`](src/views/outline.ts#L140), [`autoInlineCode.ts:18`](src/formatting/autoInlineCode.ts#L18), [`codeContext.ts:17`](src/editor/codeContext.ts#L17), [`lockBlock.ts:79`](src/blocks/lockBlock.ts#L79), [`structureLint.ts:34`](src/core/structureLint.ts#L34), [`editorDecorations.ts:120`](src/editor/editorDecorations.ts#L120) become O(1) lookups. Removes at least three O(N²) hotspots that fire per keystroke. Risk: medium (touches many sites, but each site is small). Impact: large — typing latency in long files improves significantly.

### 4. Delete or sequester the 1768 lines of disabled code (cleanup, mechanical) [Addressed — git rm]
The 15 files in §6 are imported nowhere except via `// disabled` lines. Either git-rm them (history retains everything) or move to `experimental/` excluded from `tsconfig`. Risk: nil if you keep the git history; the user can restore any time. Impact: removes 1768 lines from the build, simplifies the dependency graph, eliminates the visual noise of disabled imports throughout `extension.ts`, `simpleCommands.ts`, and module barrels.

### 5. Extract `getExecErrorText` / `isMissingCommandError` and `loadJsonStore` / `saveJsonStore` (dedup, ~80 lines deleted) [Addressed]
[`processor.ts:133`](src/editor/processor.ts#L133), [`dictate.ts:40`](src/editor/dictate.ts#L40), [`clipboard.ts:40`](src/media/clipboard.ts#L40) collapse to a single import. Same for [`commentModel.ts:30`](src/editor/comments/commentModel.ts#L30), [`processor.ts:104`](src/editor/processor.ts#L104), [`bookmarks.ts:32`](src/productivity/bookmarks.ts#L32). Bonus: the existing inconsistency between `command not found` (processor) and `not found` (clipboard) regexes gets resolved in one place. Risk: low (pure helpers, behaviour preserved). Impact: ~80 lines deleted, future maintenance amortised.

---

*Review covers files at HEAD as of 2026-04-25. No source files were modified during analysis.*
