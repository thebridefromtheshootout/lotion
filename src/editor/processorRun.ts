import { execSync } from "child_process";
import { hostEditor } from "../hostEditor/HostingEditor";
import { Regex } from "../core/regex";
import { isMissingCommandError } from "../core/execErrors";

// ── Command-name extraction ────────────────────────────────────────

function getCommandToken(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    return "";
  }
  if ((trimmed.startsWith('"') || trimmed.startsWith("'")) && trimmed.length > 1) {
    const quote = trimmed[0];
    const end = trimmed.indexOf(quote, 1);
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }
  return trimmed.split(Regex.whitespaceRunNoGlobal)[0];
}

// ── Run a processor command ────────────────────────────────────────

export function runCommand(
  command: string,
  cwd: string,
  stdinInput?: string,
  shellPath?: string,
): { output: string; exitCode: number } {
  // Processor blocks execute arbitrary user-typed shell commands. Refuse to
  // run anything when the workspace isn't trusted — the user opted out by
  // not granting workspace trust, so a malicious or accidentally-cloned
  // file can't auto-run code on /run-processor or refresh.
  if (!hostEditor.isWorkspaceTrusted()) {
    return {
      output: "[skipped: workspace is not trusted — run 'Workspaces: Manage Workspace Trust' to enable]",
      exitCode: 1,
    };
  }
  const shell = shellPath || (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      input: stdinInput,
      stdio: [stdinInput !== undefined ? "pipe" : "pipe", "pipe", "pipe"],
      shell,
    });
    return { output: output.trimEnd(), exitCode: 0 };
  } catch (err: any) {
    const stdioOutput = (err.stdout || "") + (err.stderr ? "\n[stderr] " + err.stderr : "");
    const commandToken = getCommandToken(command);

    if (isMissingCommandError(err, shell)) {
      const message = `Shell not found: ${shell}\n[hint] Select a valid shell path with /update-processor.`;
      return { output: message, exitCode: err.status || 1 };
    }
    if (commandToken && isMissingCommandError(err, commandToken)) {
      const message = `${stdioOutput.trimEnd()}\n[hint] Command not found: ${commandToken}`;
      return { output: message.trim(), exitCode: err.status || 1 };
    }

    // Timed out — execSync sends SIGTERM after the timeout window. Surface
    // it explicitly so users don't blame the script for an empty output.
    if (err.signal === "SIGTERM" || err.killed) {
      const trailer = "[timed out after 30s]";
      const body = stdioOutput.trimEnd();
      const message = body ? `${body}\n${trailer}` : trailer;
      return { output: message, exitCode: err.status || 124 };
    }

    return { output: stdioOutput.trimEnd() || err.message, exitCode: err.status || 1 };
  }
}
