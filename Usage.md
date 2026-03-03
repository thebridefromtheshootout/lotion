# Lotion — Usage Guide

Lotion is a Notion-style writing environment for VS Code, built entirely around Markdown files.
Type `/` in any Markdown file to browse all available slash commands.

---

## Settings

| Setting                    | Default        | Description                                                                     |
| -------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `lotion.dailyNotePath`     | `"journal"`    | Folder for daily notes (relative to workspace root)                             |
| `lotion.imageDir`          | `".rsrc"`      | Folder name for images alongside each page                                      |
| `lotion.readingSpeed`      | `230`          | Words per minute for reading-time estimate                                      |
| `lotion.focusModeOpacity`  | `0.35`         | Opacity of unfocused blocks in focus mode (0–1)                                 |
| `lotion.smartTypography`   | `false`        | Auto-replace straight quotes/dashes/ellipses with curly quotes, em-dashes, etc. |
| `lotion.autoRenumberLists` | `true`         | Fix ordered-list numbering on save                                              |
| `lotion.trailingNewline`   | `true`         | Ensure files end with exactly one newline on save                               |
| `lotion.dateFormat`        | `"YYYY-MM-DD"` | Default format for daily notes and date insertion                               |
| `lotion.giphyApiKey`       | `""`           | Giphy API key for `/gif` search                                                 |
| `lotion.git.neverPush`     | `false`        | Skip push after `/commit`                                                       |
| `lotion.git.remoteUrl`     | `""`           | Git remote URL to add when none is configured                                   |
| `lotion.commentUsername`   | `""`           | Your name shown on comments                                                     |

---

## Keyboard Shortcuts

### Formatting

| Shortcut          | Mac               | Action                             |
| ----------------- | ----------------- | ---------------------------------- |
| `Ctrl+B`          | `Cmd+B`           | Toggle **bold**                    |
| `Ctrl+I`          | `Cmd+I`           | Toggle _italic_                    |
| `Alt+S`           | `Alt+S`           | Toggle ~~strikethrough~~           |
| `` Alt+` ``       | `` Alt+` ``       | Toggle `inline code`               |
| `Alt+H`           | `Alt+H`           | Toggle ==highlight==               |
| `Ctrl+Shift+W`    | `Cmd+Shift+W`     | Wrap selection with custom markers |
| `Alt+Shift+Left`  | `Alt+Shift+Left`  | Promote heading (`##` → `#`)       |
| `Alt+Shift+Right` | `Alt+Shift+Right` | Demote heading (`#` → `##`)        |

### Lists

| Shortcut       | Mac           | Action                                         |
| -------------- | ------------- | ---------------------------------------------- |
| `Enter`        | `Enter`       | Continue list (bullet, number, or checkbox)    |
| `Tab`          | `Tab`         | Indent list item                               |
| `Shift+Tab`    | `Shift+Tab`   | Outdent list item                              |
| `Ctrl+Shift+X` | `Cmd+Shift+X` | Toggle checkbox `[ ]` ↔ `[x]`                  |
| `Ctrl+Shift+L` | `Cmd+Shift+L` | Cycle list type (bullet → numbered → checkbox) |

### Navigation

| Shortcut       | Mac           | Action                                |
| -------------- | ------------- | ------------------------------------- |
| `Alt+Down`     | `Alt+Down`    | Jump to next heading                  |
| `Alt+Up`       | `Alt+Up`      | Jump to previous heading              |
| `Ctrl+Shift+H` | `Cmd+Shift+H` | Jump to heading (picker)              |
| `Alt+P`        | `Alt+P`       | Quick-switch page                     |
| `Alt+R`        | `Alt+R`       | Recent pages                          |
| `Ctrl+Shift+T` | `Cmd+Shift+T` | Turn heading/link into something else |

### Blocks

| Shortcut         | Mac              | Action               |
| ---------------- | ---------------- | -------------------- |
| `Ctrl+Shift+B`   | `Cmd+Shift+B`    | Select current block |
| `Ctrl+Shift+D`   | `Cmd+Shift+D`    | Duplicate block      |
| `Alt+Shift+Up`   | `Alt+Shift+Up`   | Swap block up        |
| `Alt+Shift+Down` | `Alt+Shift+Down` | Swap block down      |

### Tables

| Shortcut    | Mac         | Action              |
| ----------- | ----------- | ------------------- |
| `Tab`       | `Tab`       | Next table cell     |
| `Shift+Tab` | `Shift+Tab` | Previous table cell |

### Other

| Shortcut | Mac     | Action                                        |
| -------- | ------- | --------------------------------------------- |
| `Ctrl+V` | `Cmd+V` | Smart paste (URLs → links, images → embedded) |
| `Ctrl+C` | `Cmd+C` | Copy (tracked in clipboard history)           |
| `Ctrl+X` | `Cmd+X` | Cut (tracked in clipboard history)            |
| `Alt+Z`  | `Alt+Z` | Toggle focus mode                             |

---

## Slash Commands

Type `/` at the start of a line in any Markdown file to see the full list.

### Content

| Command              | Description                                         |
| -------------------- | --------------------------------------------------- |
| `/h1` `/h2` `/h3`    | Insert heading at level 1, 2, or 3                  |
| `/th1` `/th2` `/th3` | Insert toggle heading (collapsible `<details>`)     |
| `/page`              | Create a child page (new Markdown file + wiki-link) |
| `/todo`              | Insert `- [ ] ` checkbox item                       |
| `/divider`           | Insert `---` horizontal rule                        |
| `/quote`             | Insert `> ` blockquote                              |
| `/toggle`            | Insert collapsible toggle block                     |
| `/callout`           | Insert callout (NOTE, TIP, WARNING, etc.)           |
| `/toc`               | Insert table of contents from headings              |
| `/footnote`          | Insert numbered footnote                            |
| `/template`          | Insert page template                                |
| `/frontmatter`       | Insert YAML front matter block                      |
| `/emoji`             | Insert emoji                                        |
| `/link`              | Insert `[[wiki-link]]` to another page              |

### Code & Math

| Command        | Description                                   |
| -------------- | --------------------------------------------- |
| `/code`        | Insert fenced code block with language picker |
| `/math`        | Insert `$$ … $$` LaTeX math block             |
| `/inline-math` | Insert `$ $` inline math                      |

### Dates

| Command  | Description                         |
| -------- | ----------------------------------- |
| `/today` | Insert today's date (pick a format) |
| `/date`  | Open date-picker calendar           |

### Media

| Command   | Description                             |
| --------- | --------------------------------------- |
| `/image`  | Insert image (file picker or clipboard) |
| `/gif`    | Search Giphy and insert a GIF           |
| `/graph`  | Insert Graphviz DOT diagram             |
| `/export` | Export page to PDF or HTML              |

### Database

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `/database`      | Create a new database                    |
| `/view-database` | Open database webview                    |
| `/new-entry`     | Add a new database entry                 |
| `/new-view`      | Create a saved view (with sort & filter) |
| `/new-field`     | Add a field to the schema                |
| `/delete-field`  | Remove a field from the schema           |

### Tables (inside a table)

| Command                     | Description                |
| --------------------------- | -------------------------- |
| `/rows-below` `/rows-above` | Add rows below or above    |
| `/cols-right` `/cols-left`  | Add columns right or left  |
| `/delete-row`               | Delete current row         |
| `/delete-col`               | Delete current column      |
| `/align`                    | Re-align table columns     |
| `/sort`                     | Sort table by column       |
| `/transpose`                | Transpose rows and columns |

### Lists (inside a list)

| Command        | Description                    |
| -------------- | ------------------------------ |
| `/renumber`    | Fix numbering of ordered list  |
| `/to-bullets`  | Convert ordered list → bullets |
| `/to-numbered` | Convert bullet list → numbered |

### Blocks

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `/move`             | Move block to another page               |
| `/secretbox`        | Insert lockable secret box               |
| `/lock`             | Encrypt a secret box (inside one)        |
| `/unlock`           | Decrypt a locked secret box (inside one) |
| `/processor`        | Insert shell-command processor block     |
| `/refresh`          | Re-run all processor blocks              |
| `/update-processor` | Change a processor's command             |
| `/render`           | Re-render graph from DOT source          |

### Productivity

| Command     | Description                           |
| ----------- | ------------------------------------- |
| `/commit`   | Git: stage all, commit & push         |
| `/comments` | Show comment panel for current page   |
| `/turninto` | Turn heading/link into something else |

---

## Features

### Smart Paste (`Ctrl+V`)

- Paste a URL while text is selected → wraps it as `[selected text](url)`
- Paste a URL on its own → inserts `[title](url)` (fetches page title)
- Paste an image from clipboard → saves to `.rsrc/` and inserts `![](path)`

### Focus Mode (`Alt+Z`)

Dims all blocks except the one under the cursor. Adjust opacity with `lotion.focusModeOpacity`.

### Smart Typography

When `lotion.smartTypography` is enabled:

- `"` → `"` / `"` (context-aware curly quotes)
- `'` → `'` / `'`
- `--` → `—` (em-dash)
- `...` → `…` (ellipsis)

### Databases

Create structured databases stored as plain Markdown. Each database is a folder with a schema in `index.md` and entries as individual `.md` files. Open the interactive webview with `/view-database` for table, kanban, and calendar layouts with filtering and sorting.

### Secret Boxes

Encrypt sensitive content in-place with a password. The encrypted ciphertext is stored directly in the Markdown file. Use `/lock` and `/unlock` to toggle. Lotion prevents saving files with unlocked secret boxes to avoid leaking plaintext.

### Daily Notes

Run **Open Daily Note** from the command palette to create or open today's note in the `lotion.dailyNotePath` folder.

### Comments

Add review-style comments to any text selection. Comments are stored in YAML front matter. Use `/comments` to open the comment panel. Comments show as CodeLens indicators above commented lines.

### Backlinks

Lotion tracks all `[[wiki-links]]` across your workspace. The Backlinks panel in the sidebar shows which pages link to the current one. A CodeLens above each page title shows the backlink count.

### Pomodoro Timer

Start a 25-minute focus timer from the command palette (**Lotion: Start Pomodoro**). Progress shows in the status bar.

### Clipboard History

Lotion tracks your last 30 copy/cut operations. Use **Paste from Clipboard History** to pick from past entries.

### Bookmarks

Bookmark frequently visited pages. Browse them from the Bookmarks panel in the sidebar.

### Page Icons

Set an emoji icon for any page via **Set Page Icon**. The icon appears in the file explorer and breadcrumb.

### Structure Linter

Automatic diagnostics for structural issues like skipped heading levels.

### Graphs

Insert Graphviz DOT diagrams with `/graph` and render them to SVG/PNG with `/render`.

### PDF Export

Export any page to a styled PDF or HTML file with `/export`.

---

## Explorer Views

| View                 | Description                            |
| -------------------- | -------------------------------------- |
| **Document Outline** | Heading hierarchy for the current file |
| **Backlinks**        | Pages that link to the current page    |
| **Bookmarks**        | Your bookmarked pages                  |

## Status Bar

| Indicator        | Description                           |
| ---------------- | ------------------------------------- |
| Word count       | Word count and estimated reading time |
| Reading progress | Scroll progress percentage            |
| Task progress    | Checkbox completion ratio (e.g. 3/7)  |
| Breadcrumb       | Current page path in the workspace    |
| Pomodoro         | Timer countdown (when active)         |
