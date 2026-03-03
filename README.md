# Lotion

**Notion-like editing for Markdown** — slash commands, databases, backlinks, and more.

Lotion transforms VS Code into a powerful Markdown writing environment inspired by Notion. Everything stays in plain Markdown files — no proprietary formats, no lock-in.

---

## Features

### Slash Commands

Type `/` at the start of any line to browse all available commands:

| Category    | Commands                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Content     | `/h1` `/h2` `/h3` `/page` `/todo` `/divider` `/quote` `/toggle` `/callout` `/toc` `/footnote` `/template` `/frontmatter` `/emoji` `/link` |
| Code & Math | `/code` `/math` `/inline-math`                                                                  |
| Dates       | `/today` `/date`                                                                                |
| Media       | `/image` `/gif` `/graph` `/export`                                                              |
| Database    | `/database` `/view-database` `/new-entry` `/new-view` `/new-field` `/delete-field`              |
| Tables      | `/rows-below` `/rows-above` `/cols-right` `/cols-left` `/delete-row` `/delete-col` `/sort` `/transpose` |
| Lists       | `/renumber` `/to-bullets` `/to-numbered`                                                        |
| Blocks      | `/move` `/secretbox` `/lock` `/unlock` `/processor` `/refresh` `/render`                        |
| Productivity| `/commit` `/comments` `/turninto`                                                               |

### Databases

Create structured databases stored as plain Markdown. Each database is a folder with a schema in `index.md` and entries as individual `.md` files. Open the interactive webview with `/view-database` for **table**, **kanban**, and **calendar** layouts with filtering and sorting.

### Backlinks & Wiki-Links

Link between pages with `[[wiki-links]]`. The **Backlinks** panel in the sidebar shows which pages link to the current one, and a CodeLens indicator above each page title shows the backlink count.

### Smart Paste

- Paste a URL while text is selected → wraps it as `[selected text](url)`
- Paste a URL on its own → inserts `[title](url)` (fetches the page title automatically)
- Paste an image from clipboard → saves it and inserts `![](path)`

### Focus Mode

Press `Alt+Z` to dim all blocks except the one under the cursor. Adjust the dimming opacity with the `lotion.focusModeOpacity` setting.

### Comments

Add review-style comments to any text selection. Comments are stored in YAML front matter and displayed as CodeLens indicators above commented lines. Open the comment panel with `/comments`.

### Secret Boxes

Encrypt sensitive content in-place with a password. The encrypted ciphertext is stored directly in the Markdown file. Lotion prevents saving files with unlocked secret boxes to avoid leaking plaintext.

### Daily Notes

Create or open today's note with **Lotion: Open Daily Note** from the command palette. Notes are stored in a configurable folder.

### PDF & HTML Export

Export any Markdown page to a styled PDF or HTML file with `/export`.

### Graphs

Insert Graphviz DOT diagrams with `/graph` and render them to SVG or PNG with `/render`.

### Additional Features

- **Pomodoro Timer** — 25-minute focus timer with status bar countdown
- **Clipboard History** — browse your last 30 copy/cut operations
- **Bookmarks** — bookmark pages and browse them from the sidebar
- **Page Icons** — set an emoji icon for any page (visible in explorer and breadcrumb)
- **Structure Linter** — diagnostics for issues like skipped heading levels
- **Smart Typography** — auto-replace straight quotes/dashes/ellipses with typographic equivalents
- **Smart Pairs** — auto-close Markdown formatting markers
- **Snippet Expander** — expand abbreviations into Markdown templates
- **Dictation** — speech-to-text input

---

## Keyboard Shortcuts

### Formatting

| Shortcut            | Mac                 | Action                             |
| ------------------- | ------------------- | ---------------------------------- |
| `Ctrl+B`            | `Cmd+B`             | Toggle **bold**                    |
| `Ctrl+I`            | `Cmd+I`             | Toggle *italic*                    |
| `Alt+S`             | `Alt+S`             | Toggle ~~strikethrough~~           |
| `` Alt+` ``         | `` Alt+` ``         | Toggle `inline code`               |
| `Alt+H`             | `Alt+H`             | Toggle ==highlight==               |
| `Ctrl+Shift+W`      | `Cmd+Shift+W`       | Wrap selection with custom markers |
| `Alt+Shift+Left`    | `Alt+Shift+Left`    | Promote heading (`##` → `#`)       |
| `Alt+Shift+Right`   | `Alt+Shift+Right`   | Demote heading (`#` → `##`)        |

### Lists

| Shortcut        | Mac            | Action                                         |
| --------------- | -------------- | ---------------------------------------------- |
| `Enter`         | `Enter`        | Continue list (bullet, number, or checkbox)    |
| `Tab`           | `Tab`          | Indent list item                               |
| `Shift+Tab`     | `Shift+Tab`    | Outdent list item                              |
| `Ctrl+Shift+X`  | `Cmd+Shift+X`  | Toggle checkbox `[ ]` ↔ `[x]`                 |
| `Ctrl+Shift+L`  | `Cmd+Shift+L`  | Cycle list type (bullet → numbered → checkbox) |

### Navigation

| Shortcut        | Mac            | Action                   |
| --------------- | -------------- | ------------------------ |
| `Alt+Down`      | `Alt+Down`     | Jump to next heading     |
| `Alt+Up`        | `Alt+Up`       | Jump to previous heading |
| `Ctrl+Shift+H`  | `Cmd+Shift+H`  | Jump to heading (picker) |
| `Alt+P`         | `Alt+P`        | Quick-switch page        |
| `Alt+R`         | `Alt+R`        | Recent pages             |

### Blocks

| Shortcut          | Mac               | Action               |
| ----------------- | ----------------- | -------------------- |
| `Ctrl+Shift+B`    | `Cmd+Shift+B`     | Select current block |
| `Ctrl+Shift+D`    | `Cmd+Shift+D`     | Duplicate block      |
| `Alt+Shift+Up`    | `Alt+Shift+Up`    | Swap block up        |
| `Alt+Shift+Down`  | `Alt+Shift+Down`  | Swap block down      |

---

## Explorer Views

| View                 | Description                            |
| -------------------- | -------------------------------------- |
| **Document Outline** | Heading hierarchy for the current file |
| **Backlinks**        | Pages that link to the current page    |
| **Bookmarks**        | Your bookmarked pages                  |

## Status Bar

| Indicator        | Description                             |
| ---------------- | --------------------------------------- |
| Word count       | Word count and estimated reading time   |
| Reading progress | Scroll progress percentage              |
| Task progress    | Checkbox completion ratio (e.g. 3/7)    |
| Breadcrumb       | Current page path in the workspace      |
| Pomodoro         | Timer countdown (when active)           |

---

## Settings

| Setting                      | Default        | Description                                           |
| ---------------------------- | -------------- | ----------------------------------------------------- |
| `lotion.dailyNotePath`       | `"journal"`    | Folder for daily notes (relative to workspace root)   |
| `lotion.imageDir`            | `".rsrc"`      | Folder name for images alongside each page            |
| `lotion.readingSpeed`        | `230`          | Words per minute for reading-time estimate            |
| `lotion.focusModeOpacity`    | `0.35`         | Opacity of unfocused blocks in focus mode (0–1)       |
| `lotion.smartTypography`     | `false`        | Auto-replace straight quotes/dashes with typographic equivalents |
| `lotion.autoRenumberLists`   | `true`         | Fix ordered-list numbering on save                    |
| `lotion.trailingNewline`     | `true`         | Ensure files end with exactly one newline on save     |
| `lotion.dateFormat`          | `"YYYY-MM-DD"` | Default format for daily notes and date insertion     |
| `lotion.giphyApiKey`         | `""`           | Giphy API key for `/gif` search                       |
| `lotion.git.neverPush`       | `false`        | Skip push after `/commit`                             |
| `lotion.git.remoteUrl`       | `""`           | Git remote URL to add when none is configured         |
| `lotion.commentUsername`     | `""`           | Your name shown on comments                           |

---

## Requirements

- VS Code 1.80 or later
- Markdown files (`.md`)

---

## License

[GPL-3.0](LICENSE.md)
