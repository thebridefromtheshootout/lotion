import { ConfigurationTarget, Position, ProgressLocation } from "../hostEditor/EditorTypes";
import type { TextDocument } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as cp from "child_process";

// ── Git Commit & Push ──────────────────────────────────────────────
//
// Slash command `/commit` that stages all changes, commits with a
// user-provided message, and optionally pushes to a remote.
// If no remote is configured, offers to set one up or opt out forever.

const NEVER_PUSH_KEY = "lotion.git.neverPush";
const REMOTE_URL_KEY = "lotion.git.remoteUrl";

/**
 * Execute a git command in the workspace root.
 * Returns stdout on success, throws on error.
 */
function git(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile("git", args, { cwd, encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Find the workspace root (git repo root) from the current file.
 */
function getWorkspaceRoot(): string | undefined {
  const folders = hostEditor.getWorkspaceFolders();
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}

/**
 * Check if a git remote is configured.
 */
async function hasRemote(cwd: string): Promise<boolean> {
  try {
    const result = await git(["remote"], cwd);
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name.
 */
async function getCurrentBranch(cwd: string): Promise<string> {
  try {
    return await git(["branch", "--show-current"], cwd);
  } catch {
    return "main";
  }
}

/**
 * Main handler for the /commit slash command.
 */
export async function handleGitCommitCommand(_document: TextDocument, _position: Position): Promise<void> {
  const cwd = getWorkspaceRoot();
  if (!cwd) {
    hostEditor.showError("Lotion Git: no workspace folder found.");
    return;
  }

  // Verify git is available and this is a repo
  try {
    await git(["rev-parse", "--is-inside-work-tree"], cwd);
  } catch {
    hostEditor.showError("Lotion Git: this workspace is not a Git repository.");
    return;
  }

  // 1. Stage all changes
  try {
    await git(["add", "-A"], cwd);
  } catch (e: any) {
    hostEditor.showError(`Lotion Git: failed to stage changes. ${e.message}`);
    return;
  }

  // Check if there's anything to commit
  const status = await git(["status", "--porcelain"], cwd);
  if (!status) {
    hostEditor.showInformation("Lotion Git: nothing to commit — working tree clean.");
    return;
  }

  // Show staged file count for context
  const fileCount = status.split("\n").filter((l) => l.trim()).length;

  // 2. Ask for commit message
  const commitMsg = await hostEditor.showInputBox({
    prompt: `Commit message (${fileCount} file${fileCount !== 1 ? "s" : ""} staged)`,
    placeHolder: "Describe your changes…",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Commit message cannot be empty";
      }
      if (v.length > 200) {
        return "Commit message too long (max 200 chars)";
      }
      return undefined;
    },
  });
  if (!commitMsg) {
    return;
  }

  // 3. Commit
  try {
    await git(["commit", "-m", commitMsg], cwd);
    hostEditor.showInformation(`✓ Committed: ${commitMsg}`);
  } catch (e: any) {
    hostEditor.showError(`Lotion Git: commit failed. ${e.message}`);
    return;
  }

  // 4. Handle push
  const config = hostEditor.getConfiguration();
  const neverPush = config.get<boolean>(NEVER_PUSH_KEY, false);

  if (neverPush) {
    return; // User has opted out of pushing
  }

  const remoteConfigured = await hasRemote(cwd);

  if (!remoteConfigured) {
    // Ask user what to do
    const action = await hostEditor.showQuickPick(
      [
        { label: "$(cloud-upload) Add Remote & Push", description: "Set a remote URL and push", value: "add" },
        { label: "$(x) Skip Push This Time", description: "Don't push, but ask again next time", value: "skip" },
        {
          label: "$(circle-slash) Never Push to Remote",
          description: "Always skip pushing (can change in settings)",
          value: "never",
        },
      ],
      { placeHolder: "No remote configured. What would you like to do?" },
    );

    if (!action || action.value === "skip") {
      return;
    }

    if (action.value === "never") {
      await config.update(NEVER_PUSH_KEY, true, ConfigurationTarget.Workspace);
      hostEditor.showInformation("Lotion Git: push disabled. Change 'lotion.git.neverPush' in settings to re-enable.");
      return;
    }

    // Ask for remote URL
    const rememberedRemote = config.get<string>(REMOTE_URL_KEY, "");
    const remoteUrl = await hostEditor.showInputBox({
      prompt: "Remote repository URL",
      placeHolder: "https://github.com/user/repo.git",
      value: rememberedRemote,
      validateInput: (v) => {
        if (!v || v.trim().length === 0) {
          return "URL cannot be empty";
        }
        return undefined;
      },
    });
    if (!remoteUrl) {
      return;
    }

    try {
      const trimmedRemote = remoteUrl.trim();
      await git(["remote", "add", "origin", trimmedRemote], cwd);
      await config.update(REMOTE_URL_KEY, trimmedRemote, ConfigurationTarget.Workspace);
      hostEditor.showInformation(`Remote 'origin' set to ${remoteUrl.trim()}`);
    } catch (e: any) {
      hostEditor.showError(`Lotion Git: failed to add remote. ${e.message}`);
      return;
    }
  }

  // 5. Push
  try {
    const branch = await getCurrentBranch(cwd);
    await hostEditor.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Pushing to remote (${branch})…`,
        cancellable: false,
      },
      async () => {
        await git(["push", "-u", "origin", branch], cwd);
      },
    );
    hostEditor.showInformation(`✓ Pushed to remote (${branch})`);
  } catch (e: any) {
    // If push fails because upstream isn't set, try with --set-upstream
    if (e.message.includes("no upstream") || e.message.includes("set-upstream")) {
      try {
        const branch = await getCurrentBranch(cwd);
        await git(["push", "--set-upstream", "origin", branch], cwd);
        hostEditor.showInformation(`✓ Pushed to remote (${branch})`);
      } catch (e2: any) {
        hostEditor.showError(`Lotion Git: push failed. ${e2.message}`);
      }
    } else {
      hostEditor.showError(`Lotion Git: push failed. ${e.message}`);
    }
  }
}
