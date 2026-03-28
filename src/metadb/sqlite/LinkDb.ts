import * as fs from "fs";
import * as path from "path";
import initSqlJs = require("sql.js");
import { Regex } from "../../core/regex";

export interface LinkRecord {
  source_path: string;
  source_line: number;
  link_text: string;
  raw_target: string;
  context: string;
}

const LINK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS links (
  source_path TEXT NOT NULL,
  source_line INTEGER NOT NULL,
  link_text   TEXT NOT NULL,
  raw_target  TEXT NOT NULL,
  context     TEXT NOT NULL,
  PRIMARY KEY (source_path, source_line, raw_target)
);
`;

const LINK_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_path, source_line);
CREATE INDEX IF NOT EXISTS idx_links_link_text ON links(link_text);
CREATE INDEX IF NOT EXISTS idx_links_context ON links(context);
`;

const INSERT_LINK_SQL = `
INSERT OR REPLACE INTO links (
  source_path,
  source_line,
  link_text,
  raw_target,
  context
) VALUES (?, ?, ?, ?, ?);
`;

const SELECT_BASE_SQL = `
SELECT
  source_path,
  source_line,
  link_text,
  raw_target,
  context
FROM links
`;

/**
 * Extension-side SQLite facade for link indexing/search.
 */
export class LinkDb {
  private sqlRuntimePromise?: Promise<initSqlJs.SqlJsStatic>;
  private dbPromise?: Promise<initSqlJs.Database>;

  constructor(private readonly dbFilePath: string) {}

  get filePath(): string {
    return this.dbFilePath;
  }

  async clear(): Promise<void> {
    const db = await this.getDatabase();
    db.run("DELETE FROM links;");
    this.persist(db);
  }

  /**
   * Rebuild the link index from markdown files under `workspaceRoot`.
   * Returns number of unique indexed links.
   */
  async fillFrom(workspaceRoot: string): Promise<number> {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
      throw new Error(`Workspace path does not exist: ${workspaceRoot}`);
    }

    const db = await this.getDatabase();
    const files = this.collectMarkdownFiles(workspaceRoot);
    const seen = new Set<string>();
    const insertStmt = db.prepare(INSERT_LINK_SQL);

    db.run("BEGIN;");
    try {
      db.run("DELETE FROM links;");

      for (const filePath of files) {
        this.indexMarkdownFile(filePath, workspaceRoot, insertStmt, seen);
      }

      db.run("COMMIT;");
    } catch (error) {
      try {
        db.run("ROLLBACK;");
      } catch {
        // Ignore rollback failures.
      }
      throw error;
    } finally {
      insertStmt.free();
    }

    this.persist(db);
    return seen.size;
  }

  /**
   * Query links by `link_text` first; if no rows, fallback to `context`.
   */
  async search(query: string, limit: number = 300): Promise<LinkRecord[]> {
    const db = await this.getDatabase();
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 300;
    const q = query.trim();

    if (!q) {
      return this.queryAll(db, safeLimit);
    }

    const byLinkText = this.queryByColumnLike(db, "link_text", q, safeLimit);
    if (byLinkText.length > 0) {
      return byLinkText;
    }

    return this.queryByColumnLike(db, "context", q, safeLimit);
  }

  private async getDatabase(): Promise<initSqlJs.Database> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDatabase();
    }
    return this.dbPromise;
  }

  private async openDatabase(): Promise<initSqlJs.Database> {
    const SQL = await this.getSqlRuntime();

    fs.mkdirSync(path.dirname(this.dbFilePath), { recursive: true });

    let db: initSqlJs.Database;
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const bytes = fs.readFileSync(this.dbFilePath);
        db = new SQL.Database(new Uint8Array(bytes));
      } catch {
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    db.run(LINK_SCHEMA_SQL);
    db.run(LINK_INDEX_SQL);
    return db;
  }

  private async getSqlRuntime(): Promise<initSqlJs.SqlJsStatic> {
    if (!this.sqlRuntimePromise) {
      this.sqlRuntimePromise = initSqlJs({
        locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
      });
    }
    return this.sqlRuntimePromise;
  }

  private persist(db: initSqlJs.Database): void {
    const bytes = db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(bytes));
  }

  private collectMarkdownFiles(workspaceRoot: string): string[] {
    const files: string[] = [];
    const stack: string[] = [workspaceRoot];
    const skipDirs = new Set([".git", "node_modules", ".vscode", "out"]);

    while (stack.length > 0) {
      const dir = stack.pop()!;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) {
            stack.push(fullPath);
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        if (entry.name.toLowerCase().endsWith(".md")) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private indexMarkdownFile(
    filePath: string,
    workspaceRoot: string,
    insertStmt: initSqlJs.Statement,
    seen: Set<string>,
  ): void {
    const text = fs.readFileSync(filePath, "utf-8");
    const lines = text.split(Regex.lineBreakSplit);
    const sourcePath = path.relative(workspaceRoot, filePath).replace(Regex.windowsSlash, "/");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      const sourceLine = lineIdx + 1;

      Regex.markdownLinkGlobal.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = Regex.markdownLinkGlobal.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        this.tryInsertLink({
          insertStmt,
          seen,
          sourcePath,
          sourceLine,
          lineText,
          start,
          end,
          rawTarget: match[2],
          linkText: match[1],
        });
      }

      Regex.htmlAnchorTagGlobal.lastIndex = 0;
      while ((match = Regex.htmlAnchorTagGlobal.exec(lineText)) !== null) {
        const href = (match[1] ?? match[2] ?? match[3] ?? "").trim();
        const anchorText = (match[4] ?? "").replace(Regex.htmlTagGlobal, "").trim();
        const start = match.index;
        const end = start + match[0].length;
        this.tryInsertLink({
          insertStmt,
          seen,
          sourcePath,
          sourceLine,
          lineText,
          start,
          end,
          rawTarget: href,
          linkText: anchorText,
        });
      }
    }
  }

  private tryInsertLink(args: {
    insertStmt: initSqlJs.Statement;
    seen: Set<string>;
    sourcePath: string;
    sourceLine: number;
    lineText: string;
    start: number;
    end: number;
    rawTarget: string;
    linkText: string;
  }): void {
    const rawTarget = args.rawTarget.trim();
    if (!Regex.httpSchemePrefix.test(rawTarget)) {
      return;
    }

    const dedupeKey = `${args.sourcePath}|${args.sourceLine}|${rawTarget}`;
    if (args.seen.has(dedupeKey)) {
      return;
    }
    args.seen.add(dedupeKey);

    args.insertStmt.run([
      args.sourcePath,
      args.sourceLine,
      args.linkText.trim(),
      rawTarget,
      this.collectContext(args.lineText, args.start, args.end),
    ]);
  }

  private collectContext(lineText: string, start: number, end: number): string {
    const pre = lineText.slice(Math.max(0, start - 50), start);
    const post = lineText.slice(end, Math.min(lineText.length, end + 50));
    return `${pre}${post}`.trim();
  }

  private queryAll(db: initSqlJs.Database, limit: number): LinkRecord[] {
    const sql = `
${SELECT_BASE_SQL}
ORDER BY source_path ASC, source_line ASC
LIMIT ?;
`;
    const stmt = db.prepare(sql);
    try {
      stmt.bind([limit]);
      const out: LinkRecord[] = [];
      while (stmt.step()) {
        out.push(this.normalizeRow(stmt.getAsObject()));
      }
      return out;
    } finally {
      stmt.free();
    }
  }

  private queryByColumnLike(
    db: initSqlJs.Database,
    column: "link_text" | "context",
    query: string,
    limit: number,
  ): LinkRecord[] {
    const sql = `
${SELECT_BASE_SQL}
WHERE ${column} LIKE ? ESCAPE '\\' COLLATE NOCASE
ORDER BY source_path ASC, source_line ASC
LIMIT ?;
`;
    const stmt = db.prepare(sql);
    try {
      stmt.bind([`%${this.escapeLikeQuery(query)}%`, limit]);
      const out: LinkRecord[] = [];
      while (stmt.step()) {
        out.push(this.normalizeRow(stmt.getAsObject()));
      }
      return out;
    } finally {
      stmt.free();
    }
  }

  private escapeLikeQuery(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  }

  private normalizeRow(row: Record<string, unknown>): LinkRecord {
    return {
      source_path: String(row.source_path ?? ""),
      source_line: Number(row.source_line ?? 0),
      link_text: String(row.link_text ?? ""),
      raw_target: String(row.raw_target ?? ""),
      context: String(row.context ?? ""),
    };
  }
}
