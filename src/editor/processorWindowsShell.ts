import { hostEditor } from "../hostEditor/HostingEditor";
import type { Processor } from "./processorStorage";
import { saveProcessors } from "./processorStorage";

// ── Windows shell resolution ───────────────────────────────────────

function resolveWindowsShellFromProfile(profile: any): string | undefined {
  if (!profile || typeof profile !== "object") {
    return undefined;
  }
  const p = profile as Record<string, unknown>;
  if (typeof p.path === "string" && p.path.trim().length > 0) {
    return p.path.trim();
  }
  if (Array.isArray(p.path) && typeof p.path[0] === "string" && p.path[0].trim().length > 0) {
    return p.path[0].trim();
  }
  if (typeof p.source === "string") {
    const source = p.source.toLowerCase();
    if (source.includes("powershell")) {
      return "pwsh.exe";
    }
    if (source.includes("command prompt")) {
      return "cmd.exe";
    }
    if (source.includes("git bash")) {
      return "bash.exe";
    }
    if (source.includes("wsl")) {
      return "wsl.exe";
    }
  }
  return undefined;
}

export async function promptWindowsShellPath(current?: string): Promise<string | undefined> {
  // VS Code does not expose an API for "all installed shells" on the machine.
  // We use configured terminal profiles when available, else ask for a shell path directly.
  const terminalCfg = hostEditor.getConfiguration("terminal.integrated");
  const profiles = terminalCfg.get<Record<string, any>>("profiles.windows") ?? {};
  const defaultProfileName = terminalCfg.get<string>("defaultProfile.windows", "");

  const items: { label: string; description?: string; detail?: string; shellPath?: string; custom?: boolean }[] = [];
  for (const [name, profile] of Object.entries(profiles)) {
    const shellPath = resolveWindowsShellFromProfile(profile);
    if (!shellPath) {
      continue;
    }
    items.push({
      label: name,
      description: shellPath,
      detail: name === defaultProfileName ? "Default terminal profile" : undefined,
      shellPath,
    });
  }

  if (items.length > 0) {
    const sorted = items.sort((a, b) => {
      const aDefault = a.label === defaultProfileName ? 0 : 1;
      const bDefault = b.label === defaultProfileName ? 0 : 1;
      if (aDefault !== bDefault) {
        return aDefault - bDefault;
      }
      return a.label.localeCompare(b.label);
    });
    sorted.push({
      label: "Custom shell path…",
      description: "Enter an explicit shell executable path",
      custom: true,
    });

    const pick = await hostEditor.showQuickPick(sorted, {
      placeHolder: "Select shell for processor command",
      matchOnDescription: true,
    });
    if (!pick) {
      return undefined;
    }
    if (!pick.custom) {
      return pick.shellPath;
    }
  }

  const input = await hostEditor.showInputBox({
    prompt: "Shell executable path for processor command",
    value: current || "pwsh.exe",
    placeHolder: "pwsh.exe, powershell.exe, cmd.exe, bash.exe, C:\\path\\to\\shell.exe",
    validateInput: (v) => {
      if (!v || v.trim().length === 0) {
        return "Shell path cannot be empty";
      }
      return undefined;
    },
  });
  return input?.trim();
}

export async function ensureWindowsProcessorShell(
  proc: Processor,
  docPath: string,
  processors: Processor[],
): Promise<string | undefined> {
  if (proc.shell && proc.shell.trim().length > 0) {
    return proc.shell;
  }

  const chosen = await promptWindowsShellPath();
  if (!chosen) {
    return undefined;
  }

  proc.shell = chosen;
  saveProcessors(docPath, processors);
  return chosen;
}
