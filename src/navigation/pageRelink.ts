import { Range, WorkspaceEdit } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import { Regex } from "../core/regex";

interface TargetParts {
  pathPart: string;
  suffix: string;
}

function splitTarget(target: string): TargetParts {
  const idx = target.search(Regex.queryOrHashMarker);
  if (idx === -1) {
    return { pathPart: target, suffix: "" };
  }
  return {
    pathPart: target.slice(0, idx),
    suffix: target.slice(idx),
  };
}

function isExternalTarget(target: string): boolean {
  return (
    Regex.httpOrMailtoOrAnchor.test(target) ||
    target.startsWith("data:") ||
    target.startsWith("file:") ||
    target.startsWith("//")
  );
}

function pathEqual(a: string, b: string): boolean {
  if (process.platform === "win32") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function isInsidePath(candidate: string, root: string): boolean {
  if (pathEqual(candidate, root)) {
    return true;
  }
  const rel = path.relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function rewriteInternalTarget(
  target: string,
  sourceDir: string,
  oldAbsDir: string,
  newAbsDir: string,
): string | undefined {
  if (!target) {
    return undefined;
  }

  const { pathPart, suffix } = splitTarget(target);
  if (!pathPart || isExternalTarget(pathPart) || path.isAbsolute(pathPart)) {
    return undefined;
  }

  const resolved = path.resolve(sourceDir, pathPart);
  if (!isInsidePath(resolved, oldAbsDir)) {
    return undefined;
  }

  const relWithinPage = path.relative(oldAbsDir, resolved);
  const newResolved = path.resolve(newAbsDir, relWithinPage);
  let newRel = path.relative(sourceDir, newResolved).replace(Regex.windowsSlash, "/");

  if (!newRel) {
    newRel = "index.md";
  } else if (pathPart.startsWith("./") && !newRel.startsWith("./") && !newRel.startsWith("../")) {
    newRel = `./${newRel}`;
  }

  return `${newRel}${suffix}`;
}

/**
 * Replace all references from old page path -> new page path across markdown files.
 * Paths are expected to be workspace-relative (slash-separated).
 */
export async function relinkWorkspacePagePaths(oldRelFromRoot: string, newRelFromRoot: string): Promise<number> {
  const workspaceRoot = hostEditor.getWorkspaceFolders()?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return 0;
  }

  const oldAbsDir = path.resolve(workspaceRoot, oldRelFromRoot);
  const newAbsDir = path.resolve(workspaceRoot, newRelFromRoot);
  const mdFiles = await hostEditor.findFiles("**/*.md", "**/node_modules/**");
  let updatedCount = 0;

  for (const uri of mdFiles) {
    try {
      const doc = await hostEditor.openTextDocument(uri);
      const text = doc.getText();
      const sourceDir = path.dirname(uri.fsPath);
      const edit = new WorkspaceEdit();
      let fileChanged = false;

      const linkRe = new RegExp(Regex.markdownLinkGlobal.source, "g");
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(text)) !== null) {
        // Skip image links: ![alt](target)
        if (match.index > 0 && text[match.index - 1] === "!") {
          continue;
        }

        const target = match[2];
        const rewritten = rewriteInternalTarget(target, sourceDir, oldAbsDir, newAbsDir);
        if (!rewritten || rewritten === target) {
          continue;
        }

        const targetOffset = match.index + match[0].indexOf(target);
        const start = doc.positionAt(targetOffset);
        const end = doc.positionAt(targetOffset + target.length);
        edit.replace(uri, new Range(start, end), rewritten);
        fileChanged = true;
      }

      const refDefRe = new RegExp(Regex.refLinkDefinitionGlobalMultiline.source, "gm");
      while ((match = refDefRe.exec(text)) !== null) {
        const target = match[2];
        const rewritten = rewriteInternalTarget(target, sourceDir, oldAbsDir, newAbsDir);
        if (!rewritten || rewritten === target) {
          continue;
        }

        const targetOffset = match.index + match[0].indexOf(target);
        const start = doc.positionAt(targetOffset);
        const end = doc.positionAt(targetOffset + target.length);
        edit.replace(uri, new Range(start, end), rewritten);
        fileChanged = true;
      }

      if (!fileChanged) {
        continue;
      }

      await hostEditor.applyWorkspaceEdit(edit);
      await doc.save();
      updatedCount++;
    } catch {
      // skip files that cannot be edited
    }
  }

  return updatedCount;
}
