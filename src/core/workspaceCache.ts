// Generic per-workspace JSON cache.
//
// Two feature modules (links/searchLinks, editor/searchCommands) each
// maintained their own copy of the same pattern: hash the workspace root,
// drop a JSON payload at <globalStorage>/cache/<bucket>/<hash>.json, validate
// the version + shape on read, quarantine on parse failure. This module
// captures the pattern as a class so the feature modules just describe their
// record shape and validator.

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { hostEditor } from "../hostEditor/HostingEditor";

interface CachePayload<T> {
  version: number;
  workspaceRoot: string;
  generatedAt: string;
  records: T[];
}

export interface WorkspaceCacheOptions<T> {
  /** Sub-folder under <globalStorage>/cache/. */
  bucket: string;
  /** Bumped when the record shape changes; older payloads are dropped. */
  version: number;
  /** Optional per-record validator. Records that fail are filtered out. */
  validateRecord?: (value: unknown) => value is T;
}

export class WorkspaceCache<T> {
  private readonly opts: WorkspaceCacheOptions<T>;

  constructor(opts: WorkspaceCacheOptions<T>) {
    this.opts = opts;
  }

  /** Read cached records for `workspaceRoot`, or undefined if missing / stale / corrupt. */
  read(workspaceRoot: string): T[] | undefined {
    const filePath = this.cacheFilePath(workspaceRoot);
    if (!filePath || !fs.existsSync(filePath)) return undefined;

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const payload = JSON.parse(raw) as Partial<CachePayload<T>>;
      if (
        payload.version !== this.opts.version ||
        payload.workspaceRoot !== workspaceRoot ||
        !Array.isArray(payload.records)
      ) {
        this.tryUnlink(filePath);
        return undefined;
      }
      const records = payload.records as T[];
      return this.opts.validateRecord ? records.filter(this.opts.validateRecord) : records;
    } catch {
      this.tryUnlink(filePath);
      return undefined;
    }
  }

  /** Write `records` for `workspaceRoot`. Silently no-ops when no global storage path is available. */
  write(workspaceRoot: string, records: T[]): void {
    const filePath = this.cacheFilePath(workspaceRoot);
    if (!filePath) return;

    const payload: CachePayload<T> = {
      version: this.opts.version,
      workspaceRoot,
      generatedAt: new Date().toISOString(),
      records,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
  }

  private cacheFilePath(workspaceRoot: string): string | undefined {
    const storageRoot = hostEditor.getGlobalStoragePath();
    if (!storageRoot) return undefined;
    const dir = path.join(storageRoot, "cache", this.opts.bucket);
    fs.mkdirSync(dir, { recursive: true });
    const key = createHash("sha1").update(workspaceRoot).digest("hex");
    return path.join(dir, `${key}.json`);
  }

  private tryUnlink(filePath: string): void {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}
