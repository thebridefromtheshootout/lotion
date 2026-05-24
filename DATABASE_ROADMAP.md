# Database Roadmap — Making Lotion's Databases Useful for Real Work

Premise: Lotion's database engine today is a playground. It has views, filters, sort, multiple layouts, and inline editing — enough to show off, not enough to plan with. The unique pitch — **plain markdown on disk + a real database engine** — only matters if the engine is real. Notion users keep paying for Notion because formulas, relations, and rollups turn a table into a planning tool. Without those, Lotion competes with Obsidian's Dataview (which is more powerful in places) and Notion (which has the network effects). With them, Lotion becomes meaningfully better than either: Dataview is query-only, Notion locks your data in.

This doc inventories what's missing and proposes concrete shapes for the gaps, ordered by impact/effort.

---

## Where we are today

| Surface              | Status                                                                                                                                                            | File(s)                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Column types**     | text, number, select, multi-select, date, checkbox, url, image, coordinates. All stored as `string` property values in markdown.                                  | [`databaseTypes.ts:7`](src/contracts/databaseTypes.ts#L7)                                                       |
| **Schema fence**     | YAML-ish in a ` ```lotion-db ` fence on `index.md`. Hand-rolled parser. Supports `name`, `type`, `options`, `maxWidth`, `maxHeight`, plus top-level `titleField`. | [`dbSchema.ts:84-151`](src/database/dbSchema.ts#L84)                                                            |
| **Entries**          | `<slug>/index.md` with `# Title` heading + a `\| Property \| Value \|` markdown table.                                                                            | [`dbFrontmatter.ts`](src/database/dbFrontmatter.ts), [`dbEntryCreate.ts:65`](src/database/dbEntryCreate.ts#L65) |
| **Views**            | Saved per-DB in a separate fence. Sort, filters (incl. tree), layout (table/kanban/calendar/graph/map), kanbanGroupCol, calendarDateCol, calendarEndDateCol.      | [`dbViews.ts`](src/database/dbViews.ts), [`databaseTypes.ts:69-80`](src/contracts/databaseTypes.ts#L69)         |
| **Imports**          | CSV (`/csv-to-db`), markdown table (`/table-to-db`).                                                                                                              | [`dbTabularImport.ts:236-259`](src/database/dbTabularImport.ts#L236)                                            |
| **Exports**          | CSV (`Copy CSV` button in toolbar). No JSON. No "publish DB as HTML."                                                                                             | [`Toolbar.tsx`](src/webview/components/database/Toolbar.tsx), [`csv.ts`](src/webview/utils/csv.ts)              |
| **Entry creation**   | Prompts for each property value in sequence via input boxes; creates `<slug>/index.md`; appends an ordered-list link to the index.                                | [`dbEntryCreate.ts:25-80`](src/database/dbEntryCreate.ts#L25)                                                   |
| **Cross-DB linking** | Informal — you can put a markdown link to another DB's entry into a text cell. The backlinks sidebar surfaces it. Not modeled as a relation.                      | (emergent behavior)                                                                                             |

The architecture is solid. The schema fence + property table + saved views model is **the right shape**. What's missing isn't a foundation rewrite — it's adding the next layer.

---

## Tier 1 — Real-work essentials

These are what makes the difference between "I can list things" and "I can plan with this." Without them, the database is a typed list.

### 1.1 Formulas (computed columns)

**Why it matters:** Every serious database tool has this. `=concat(first, " ", last)`, `=daysSince(due)`, `=if(status == "done", "✓", "✗")`, `=price * quantity`. Without formulas you can't derive a Total, a Days Remaining, a Status icon, a Display Name. Users either give up or maintain the value manually.

**Proposed shape:**

```yaml
columns:
  - name: Full Name
    type: formula
    formula: 'concat(first, " ", last)'
    returns: text
  - name: Days Until Due
    type: formula
    formula: "daysBetween(now(), due)"
    returns: number
```

**Storage:** Formula columns are **not stored** in the property table on each entry — they're computed at view-time. The schema fence carries the formula expression.

**Engine choices:**

- Write a small s-expression-flavored evaluator (~200 LOC). Tokenize → parse → eval with a table of built-ins (`concat`, `if`, `sum`, `daysBetween`, `now`, `lower`, `upper`, comparisons, arithmetic). Pure functions only. No loops, no recursion.
- Reuse [expr-eval](https://github.com/silentmatt/expr-eval) (small npm dep) or [filtrex](https://github.com/m93a/filtrex). Trade dep weight for not maintaining a parser.

**Tricky bits:**

- **Cycle detection.** `a = b + 1` and `b = a - 1` must be caught at parse-time. Topo-sort the formula DAG.
- **Type inference.** Formulas can return different types per row if expressions branch. Either require a declared `returns:` (cleaner) or infer per-cell.
- **Empty / missing values.** What does `null + 1` produce? Probably `null`. Sort + filter need to handle.
- **Where does evaluation run?** Webview side (fast, but the schema needs to ship the formula). Or extension side (slower, batches with file loads). Webview is right — formulas are display-only.

**Files affected:** New `src/webview/utils/formulaEval.ts` + tests. [`databaseTypes.ts`](src/contracts/databaseTypes.ts) (DbColumn `type: "formula"`, `formula: string`, `returns?: type`). [`dbSchema.ts`](src/database/dbSchema.ts) parser+serializer. [`FormatCell.tsx`](src/webview/components/database/tableview/FormatCell.tsx) renders computed values. [`InlineEditor`](src/webview/components/database/tableview/InlineEditor.tsx) refuses edits on formula cells. Sort/filter ([`filterSort.ts`](src/webview/utils/filterSort.ts)) reads the computed value instead of `properties[col]`.

**Effort:** Medium-large (~1 week). Most of it is the evaluator + cycle detector + tests; the wiring is small.

**Unblocks:** §1.3 rollups (rollups are a special-case formula over a relation).

---

### 1.2 Relations between databases

**Why it matters:** Nothing in Lotion today says "this entry belongs to that project" in a way the engine understands. You can paste a markdown link into a text cell, but the engine sees it as a string. With real relations:

- Click a relation cell → autocomplete from the target DB's entries.
- Pivot views: filter Tasks by Project, show Project's tasks on the project page.
- Reverse links surface in the linked entry as a first-class panel, not just in the backlinks sidebar.

**Proposed shape:**

```yaml
columns:
  - name: Project
    type: relation
    relation: ../projects # path to the related DB's folder (containing index.md)
    cardinality: one # or "many" — single relation vs list of relations
```

**Storage in the property table:**

```markdown
| Property | Value                            |
| -------- | -------------------------------- |
| Project  | [[../projects/website-redesign]] |
```

(Or whatever wikilink/markdown shape; the important thing is the engine recognizes "this property holds a target ref" instead of a string.)

**Bidirectional surfacing:** When DB A has `relation: ../B` and entry-a has `B-entry-3` as the value, B-entry-3's page should render a "Related from A" panel listing entry-a. This is a CodeLens / hover / inline-panel decision — probably CodeLens for discoverability.

**Tricky bits:**

- **Path resolution.** Should `relation:` be a path, a glob, or a DB ID? Path is simplest but breaks if you move the DB. A symbolic DB ID requires a registry. Start with path; add IDs later if it bites.
- **Many-cardinality storage.** Multiple wikilinks in one cell, semicolon- or newline-separated? Or one row per relation? One cell is simpler for the table view; one row per relation is more relational-DB-correct.
- **Inline editing.** A relation cell needs a search-as-you-type picker over the target DB's entries — similar to wikilink completion. Reuse the workspace link search machinery ([`searchLinks.ts`](src/links/searchLinks.ts)).

**Files affected:** [`databaseTypes.ts`](src/contracts/databaseTypes.ts) (new `type: "relation"`, `relation: string`, `cardinality: "one" | "many"`). [`dbSchema.ts`](src/database/dbSchema.ts) parser. [`FormatCell.tsx`](src/webview/components/database/tableview/FormatCell.tsx) — render as link with optional title-fetch. [`InlineEditor`](src/webview/components/database/tableview/InlineEditor.tsx) — DB-entry picker. New `src/webview/components/database/RelationPicker.tsx`. Hover / backlink panel: new entry-page CodeLens that lists incoming relations.

**Effort:** Medium (~3-5 days). Picker UI is the hardest part.

**Unblocks:** §1.3 rollups, §2.3 cross-DB views.

---

### 1.3 Rollups (aggregations across a relation)

**Why it matters:** Once you have relations, the next question is "how many tasks does this project have?" "What's the total budget?" "When's the next due date?" In Notion these are first-class "Rollup" properties.

**Proposed shape:**

```yaml
columns:
  - name: Task Count
    type: rollup
    via: tasks # name of the relation column on this entry
    target: __title # column on the related DB to aggregate
    aggregate: count
  - name: Total Budget
    type: rollup
    via: line_items
    target: amount
    aggregate: sum
  - name: Next Due
    type: rollup
    via: tasks
    target: due_date
    aggregate: min
```

**Aggregates:** `count`, `sum`, `avg`, `min`, `max`, `concat` (string), `latest` (date), `earliest` (date), `unique_count`, `any` / `all` (boolean).

**Engine:** Reuses the formula evaluator's read-only semantics, with built-in functions over a collection. Pre-requirement: §1.1 + §1.2.

**Tricky bits:**

- **Performance.** A rollup means loading the entire related DB at view-time. Need a cache. Reuse the existing workspace-cache infrastructure ([`workspaceCache.ts`](src/core/workspaceCache.ts), if I have the name right from CODE_QUALITY).
- **Type compatibility.** `sum` on a non-numeric column is undefined. Validate at schema-parse time.

**Effort:** Small once §1.1 + §1.2 are in (~2 days).

---

### 1.4 Templates per database

**Why it matters:** "New Entry" today prompts for each property value in a sequence of input boxes ([`dbEntryCreate.ts:25-80`](src/database/dbEntryCreate.ts#L25)). For a project-tracker DB you'd want: "New Bug" template (pre-fills `type: bug`, `priority: medium`, body section "## Repro\n## Expected\n## Actual"); "New Feature" template; etc. Today you'd have to repeat that flow every time.

**Proposed shape:** Templates live in the DB folder as `_templates/<name>.md` (or `.templates/`), each a markdown file with a `templateFor:` frontmatter pointing to the DB and a body that uses `{{property}}` placeholders the user fills in. Schema fence opts in:

```yaml
templates:
  - bug
  - feature
  - chore
```

**UI:** Clicking "+ New Entry" in the toolbar opens a tiny chooser (the templates listed in the schema, plus "Blank") before the property-value prompts.

**Files affected:** New `src/database/dbTemplates.ts` (list, read, instantiate). [`dbEntryCreate.ts`](src/database/dbEntryCreate.ts) — branch into template flow if templates exist. [`Toolbar.tsx`](src/webview/components/database/Toolbar.tsx) — replace single "New Entry" button with a split-button if templates exist.

**Effort:** Small (~1 day).

---

### 1.5 Validation: required, unique, default

**Why it matters:** Today a `number` column accepts the string `"abc"`. A `select` column accepts a value not in its `options:` list. No way to mark a column as required. No way to enforce uniqueness (slug, ID, email). No default values on new entries.

**Proposed shape:**

```yaml
columns:
  - name: Status
    type: select
    options: [todo, doing, done]
    required: true
    default: todo
  - name: Slug
    type: text
    unique: true
  - name: Priority
    type: number
    required: true
    min: 1
    max: 5
    default: 3
```

**Enforcement:** At entry-creation prompts ([`promptForColumnValue`](src/database/dbColumnPrompt.ts)) and at inline-edit commit ([`InlineEditor`](src/webview/components/database/tableview/InlineEditor.tsx)) — refuse to commit, surface a diagnostic. At read-time, surface a `lotion-validation` diagnostic on the offending entry file (uses the existing diagnostics infrastructure from [`structureLint.ts`](src/core/structureLint.ts)).

**Files affected:** [`databaseTypes.ts`](src/contracts/databaseTypes.ts) (new column fields). [`dbSchema.ts`](src/database/dbSchema.ts) parser+serializer. [`dbColumnPrompt.ts`](src/database/dbColumnPrompt.ts) enforces. New `src/database/dbValidate.ts` for runtime checks. New diagnostic collection.

**Effort:** Small-medium (~2 days).

---

## Tier 2 — High-leverage adds

These don't change the database's fundamental capability but make day-to-day use materially better.

### 2.1 Form view / quick-entry

A compact form panel for adding entries — one at a time, one screen, all properties at once instead of sequential prompts. Modal or side panel. Faster than the prompt flow when adding many entries.

**Files:** New `src/webview/components/database/FormView.tsx`. [`Toolbar.tsx`](src/webview/components/database/Toolbar.tsx) gets a layout toggle for "form."

**Effort:** Small (~1 day).

---

### 2.2 Better imports

Today: CSV, markdown table. Add:

- **JSON / ndjson** — `/json-to-db` from clipboard or file. Auto-infer schema from key types.
- **Frontmatter scan** — `/folder-to-db` walks a folder of markdown files with frontmatter, derives schema from frontmatter keys, treats each file as an entry. Lifts existing markdown vaults into structured DBs in one shot.

**Files:** Extend [`dbTabularImport.ts`](src/database/dbTabularImport.ts) or split into `dbImport/` directory.

**Effort:** Small (~1 day per importer).

---

### 2.3 Better exports

Today: CSV via toolbar button. Add:

- **JSON export** (single button or `/db-to-json`).
- **Markdown table** export (single button — useful for pasting summaries into other pages).
- **Publish DB as static HTML** — render the current view as a standalone HTML file (or set of files). Drop into `public/` for Pages/Vercel/Netlify hosting. This is the "share my DB" path that lots of people want.

**Effort:** Small (~1 day for JSON+MD, half-week for HTML publish).

---

### 2.4 Inline DB summaries on other pages

A way to embed a live count/sum/value from a DB onto any markdown page:

```markdown
Currently tracking <!-- lotion-db-count: ./projects --> active projects.

Total budget so far: $<!-- lotion-db-rollup: ./line_items aggregate=sum target=amount -->.
```

Implemented as CodeLens or inline decorator that resolves at render time. Once relations + rollups exist (Tier 1), inline summaries fall out almost for free.

**Files:** New `src/database/dbInlineSummary.ts`. CodeLens registration.

**Effort:** Small-medium (~2 days, mostly choosing the marker syntax and resolving paths).

---

### 2.5 Bulk edit / multi-select rows

Shift-click to select multiple rows, then edit a single column for all of them in one operation. Useful when reorganizing.

**Effort:** Small (~1 day). Needs row-selection state in `TableView`, plus a "edit selected" affordance.

---

### 2.6 Hidden / reordered columns per view

(Verify whether this already exists — couldn't see it in `DbView`. If not, it's a per-view list of column names + their visibility.)

**Effort:** Half-day.

---

## Tier 3 — Polish

These are honest paper cuts more than feature gaps.

| Item                           | Why                                                                                                                           | Effort        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Property history / audit trail | Data is git-tracked. A CodeLens "see history" on entry pages calling `git log` for that property would be cheap and powerful. | Half-day.     |
| Conditional formatting         | Color a row when `status == done`, italicize when `archived: true`. Most DB tools have this.                                  | 1 day.        |
| Per-column descriptions        | Schema columns are name+type only; no tooltips. A `description:` field renders as the column header's title attribute.        | Quick.        |
| Filter UI cleanup              | See [FILTER_BAR_AUDIT.md](FILTER_BAR_AUDIT.md) for the full set.                                                              | See that doc. |
| "Recently changed" indicator   | A dot/badge on entries modified in the last N hours (from `fs.statSync.mtime`).                                               | Half-day.     |
| Pagination on large DBs        | Today's table view renders every entry. With 5,000+ entries, that's slow. Virtualize the table (react-window) or paginate.    | 1 day.        |
| `datetime` column type         | Today's `date` column type truncates time-of-day in the filter input. Add a `datetime` type with `type="datetime-local"` input and epoch-ms compare. Referenced from [FILTER_BAR_AUDIT.md #17](FILTER_BAR_AUDIT.md). | Half-day.     |

---

## Suggested order

Tier-1 items have hard dependencies on each other:

```
1.1 Formulas  ───┐
                 ├──→ 1.3 Rollups
1.2 Relations  ──┘                    ──→ 2.4 Inline DB summaries
                                      ──→ 2.3 (HTML publish — wants formulas resolved)
1.4 Templates       (independent)
1.5 Validation      (independent)
```

If I had to pick one to ship next, **§1.5 Validation** is the highest-leverage cheapest win — it makes the existing engine more trustworthy without adding new concepts. **§1.4 Templates** is the second-cheapest and removes the friction wall on entry creation.

The big-bet sequence is **§1.2 Relations → §1.3 Rollups → §1.1 Formulas**, in that order. Relations gate everything; rollups are the smallest layer on top; formulas are the biggest but the highest-leverage.

The fast "deliver something cool" sequence is **§2.2 + §2.3** (importers + exporters + HTML publish) — independently shippable, no engine changes, real audience expansion ("my notes vault is now a queryable DB I can publish").
