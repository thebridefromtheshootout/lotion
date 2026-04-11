
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { Regex } from "../core/regex";

// ── Platform detection ─────────────────────────────────────────────

type Platform = "win32" | "darwin" | "linux";
export interface ClipboardImageProbeResult {
  hasImage: boolean;
  missingDependencyMessage?: string;
}

interface ClipboardPlatformHandler {
  commandName: string;
  missingDependencyMessage: string;
  probeHasImage: () => boolean;
  saveImage: (filePath: string) => void;
}

function getPlatform(): Platform {
  if (process.platform === "linux") {
    try {
      const release = fs.readFileSync("/proc/version", "utf-8");
      if (/microsoft|wsl/i.test(release)) {
        return "win32";
      }
    } catch {
      /* not linux or no /proc/version */
    }
  }
  return process.platform as Platform;
}

const PLATFORM = getPlatform();
const IS_WSL = process.platform === "linux" && PLATFORM === "win32";

function getExecErrorText(err: any): string {
  const parts = [err?.message, err?.stderr, err?.stdout].filter((v) => typeof v === "string" && v.length > 0);
  return parts.join("\n");
}

function isMissingCommandError(err: any, command?: string): boolean {
  const text = getExecErrorText(err);
  const genericMissing =
    /not found/i.test(text) ||
    /is not recognized as an internal or external command/i.test(text) ||
    /The term .* is not recognized/i.test(text) ||
    /ENOENT/i.test(text);
  if (!genericMissing) {
    return false;
  }
  if (!command) {
    return true;
  }
  return text.toLowerCase().includes(command.toLowerCase());
}

const CLIPBOARD_HANDLERS: Record<Platform, ClipboardPlatformHandler> = {
  win32: {
    commandName: "powershell.exe",
    missingDependencyMessage: "Lotion: PowerShell not found. Install/enable PowerShell to paste clipboard images.",
    probeHasImage: () => {
      execSync('powershell.exe -NoProfile -Command "if (-not (Get-Clipboard -Format Image)) { exit 1 }"', {
        stdio: "pipe",
        timeout: 5000,
      });
      return true;
    },
    saveImage: (filePath: string) => {
      let winPath = filePath;
      if (IS_WSL) {
        try {
          winPath = execSync(`wslpath -w "${filePath}"`, { encoding: "utf-8", stdio: "pipe" }).trim();
        } catch (err: any) {
          if (isMissingCommandError(err, "wslpath")) {
            throw new Error("Lotion: wslpath not found. wslpath is required for clipboard image paste in WSL.");
          }
          throw err;
        }
      }
      const psScript = [
        "$img = Get-Clipboard -Format Image",
        "if ($null -eq $img) { exit 1 }",
        `$img.Save('${winPath.replace(Regex.singleQuote, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
      ].join("; ");
      execSync(`powershell.exe -NoProfile -Command "${psScript}"`, {
        stdio: "pipe",
        timeout: 10000,
      });
    },
  },
  darwin: {
    commandName: "osascript",
    missingDependencyMessage: "Lotion: osascript not found. macOS AppleScript is required for clipboard image paste.",
    probeHasImage: () => {
      const result = execSync('osascript -e "clipboard info"', { stdio: "pipe", timeout: 5000, encoding: "utf-8" });
      return Regex.clipboardDarwinImageTypes.test(result);
    },
    saveImage: (filePath: string) => {
      execSync(
        `osascript -e 'set pngData to the clipboard as «class PNGf»' ` +
          `-e 'set fp to open for access POSIX file "${filePath}" with write permission' ` +
          `-e 'write pngData to fp' ` +
          `-e 'close access fp'`,
        { stdio: "pipe", timeout: 10000 },
      );
    },
  },
  linux: {
    commandName: "xclip",
    missingDependencyMessage: "Lotion: xclip not found. Install xclip to paste clipboard images.",
    probeHasImage: () => {
      const targets = execSync("xclip -selection clipboard -t TARGETS -o", {
        stdio: "pipe",
        timeout: 5000,
        encoding: "utf-8",
      });
      return Regex.clipboardLinuxImageTypes.test(targets);
    },
    saveImage: (filePath: string) => {
      execSync(`xclip -selection clipboard -t image/png -o > "${filePath}"`, {
        stdio: "pipe",
        timeout: 10000,
        shell: "/bin/sh",
      });
    },
  },
};

function getClipboardHandler(): ClipboardPlatformHandler | undefined {
  return CLIPBOARD_HANDLERS[PLATFORM];
}

// ── Clipboard image check ──────────────────────────────────────────

/**
 * Check whether the system clipboard contains an image.
 * Uses native OS tools — no Python dependency.
 */
export function clipboardHasImage(): boolean {
  return probeClipboardImage().hasImage;
}

export function probeClipboardImage(): ClipboardImageProbeResult {
  const handler = getClipboardHandler();
  if (!handler) {
    return { hasImage: false };
  }

  try {
    return { hasImage: handler.probeHasImage() };
  } catch (err: any) {
    if (isMissingCommandError(err, handler.commandName)) {
      return {
        hasImage: false,
        missingDependencyMessage: handler.missingDependencyMessage,
      };
    }
    return { hasImage: false };
  }
}

// ── Save clipboard image to disk ───────────────────────────────────

/**
 * Save the clipboard image to `rsrcDir/<imageName>.png`.
 * Uses native OS tools — no Python dependency.
 */
export async function imageFromClipboard(rsrcDir: string, imageName: string): Promise<string | undefined> {
  const fileName = `${imageName}.png`;
  const filePath = path.join(rsrcDir, fileName);
  const handler = getClipboardHandler();

  if (!handler) {
    hostEditor.showError("Lotion: unsupported platform for clipboard image.");
    return undefined;
  }

  try {
    handler.saveImage(filePath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      // Clean up empty file if created
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      hostEditor.showError("Lotion: failed to save clipboard image.");
      return undefined;
    }

    return fileName;
  } catch (err: any) {
    // Clean up partial file on failure
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    if (isMissingCommandError(err, handler.commandName)) {
      hostEditor.showError(handler.missingDependencyMessage);
      return undefined;
    }
    const msg: string | undefined = err?.message;
    hostEditor.showError(msg?.startsWith("Lotion:") ? msg : "Lotion: failed to save clipboard image.");
    return undefined;
  }
}
