# Lotion

VS Code extension that brings Notion-like editing to plain Markdown files. The aim is to make editing `.md` files feel like Notion (slash commands, databases, backlinks, link unfurling, comments, drag-and-drop images) while keeping the underlying storage as plain text + git-friendly folders.

## Architecture

- **Extension host** (`src/*`, excluding `webview/`): runs in Node.js inside VS Code, compiled by `tsc` to `out/`.
- **Webview UIs** (`src/webview/`): React apps for the database view, dictation panel, etc. Bundled by `esbuild` (see `esbuild.webview.mjs`) to `out/webview/`.
- **HostEditor abstraction** (`src/hostEditor/`): all VS Code API access goes through `hostEditor` so editor-side modules don't import `vscode` directly. When you need an editor capability, add it here first.
- **Communicators** (`src/communicators/`): typed message channels between extension host and webviews. Contracts live in `src/contracts/`.

## Top-level features by directory

| Dir | What lives here |
|---|---|
| `core/` | Slash command registry (`slashCommands.ts`), command IDs (`commands.ts`), filter system (`cmdFilter.ts` — `Filter().pageIsDbIndex()` style), regex constants (`regex.ts`), simple-command map (`simpleCommands.ts`), webview shell, file hash tracker |
| `editor/` | Slash command handlers (callout, code block, date, emoji, footnote, TOC, etc.), smart paste with link unfurling (`smartPaste.ts` — oEmbed + HTML title scraping), table tools, comments, processors, dictation, command search (`searchCommands.ts`) |
| `database/` | Notion-style databases. A "DB index" is an `index.md` with a ` ```lotion-db ` schema fence; child entries are `<slug>/index.md` siblings. `dbWebview.ts` opens the table view; `dbEntries.ts` has `findParentDbIndex` / `cursorInDb` |
| `formatting/` | Heading colors, smart typography, auto-inline-code (`autoInlineCode.ts`), link factory rules (`linkFactory.ts` — regex → autolink), wrap/toggle |
| `links/` | Link completion, hover, validation, workspace link search (`searchLinks.ts`) |
| `navigation/` | Breadcrumbs, recent pages, page tree, jump-to-heading |
| `media/` | Image drop/paste/hover, GIF picker, graph rendering, clipboard image handling (WSL-aware) |
| `views/` | Outline, page icons, reading progress, word count |
| `productivity/` | Bookmarks, strikethrough decorations |
| `blocks/` | Block-level operations (swap, duplicate, select), secretbox/lock blocks |
| `lists/` | List continuation, indent/outdent, renumber, checkbox toggle |

## Conventions

- **Slash commands**: defined as `SlashCommand` objects with `commandId`, `handler`, optional `cmdFilter` (e.g. `Filter().pageIsNotDbIndex()`). Most are auto-registered from `SLASH_COMMANDS` in `extension.ts`; a few with custom arg handling (`openDbWebview`, `dbAddEntry`) are registered manually.
- **Settings**: under the `lotion.*` namespace in `package.json` `contributes.configuration`. Read with `hostEditor.getConfiguration("lotion").get<T>("name", default)`.
- **Shared link helper**: `buildAnchorTag(url, label?)` in `editor/smartPaste.ts` is the single source of truth for fetching titles + building `<a>` tags. Reuse it; don't reimplement the fetch/escape/truncate dance.
- **Filters over context checks**: prefer adding a method to `CmdFilter` (and a flag to `CursorContext`) over inline conditions in handlers.
- **No `vscode` imports outside `hostEditor/`** — if you find yourself wanting one, add the capability to `HostingEditor` first.

## Build / package

- `npm run compile` — runs `tsc` then `esbuild.webview.mjs`.
- `npx vsce package` — produces the `.vsix`. `.vscodeignore` is tuned to keep only `unicode-emoji-json` and `@viz-js/viz` from `node_modules` (rest is bundled or unused at runtime).

## Tests

Two suites, run independently:

- `src/__tests__/` — Jest unit tests for pure helpers (csvParser, blockIndex, lockBlockCrypto, etc.). `vscode` is mocked via `src/__tests__/__mocks__/vscode.ts`. Run with `npm test`.
- `src/test/` — integration tests via `@vscode/test-cli`, launching a real VS Code
  (`@vscode/test-electron`). Configured in `.vscode-test.mjs`; tests compile to
  `out/test/`. Run with `npm run test:int`. Use mocha BDD (`describe`/`it`).
