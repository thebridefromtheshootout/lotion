
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { Regex } from "../core/regex";

// ── Platform detection ─────────────────────────────────────────────

type Platform = "win32" | "darwin" | "linux";

function getPlatform(): Platform {
  return process.platform as Platform;
}

function getExecErrorText(err: any): string {
  const parts = [err?.message, err?.stderr, err?.stdout].filter((v) => typeof v === "string" && v.length > 0);
  return parts.join("\n");
}

function isMissingCommandError(err: any, command?: string): boolean {
  const text = getExecErrorText(err);
  const genericMissing =
    /command not found/i.test(text) ||
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

// ── Clipboard image check ──────────────────────────────────────────

/**
 * Check whether the system clipboard contains an image.
 * Uses native OS tools — no Python dependency.
 */
export function clipboardHasImage(): boolean {
  try {
    switch (getPlatform()) {
      case "win32":
        // PowerShell: check if clipboard contains an image
        execSync('powershell -NoProfile -Command "if (-not (Get-Clipboard -Format Image)) { exit 1 }"', {
          stdio: "pipe",
          timeout: 5000,
        });
        return true;

      case "darwin":
        // osascript: check clipboard for «class PNGf» or «class TIFF»
        const result = execSync('osascript -e "clipboard info"', { stdio: "pipe", timeout: 5000, encoding: "utf-8" });
        return Regex.clipboardDarwinImageTypes.test(result);

      case "linux":
        // xclip: list clipboard targets and check for image types
        const targets = execSync("xclip -selection clipboard -t TARGETS -o", {
          stdio: "pipe",
          timeout: 5000,
          encoding: "utf-8",
        });
        return Regex.clipboardLinuxImageTypes.test(targets);

      default:
        return false;
    }
  } catch {
    return false;
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

  try {
    switch (getPlatform()) {
      case "win32":
        // PowerShell: save clipboard image as PNG
        const psScript = [
          "$img = Get-Clipboard -Format Image",
          "if ($null -eq $img) { exit 1 }",
          `$img.Save('${filePath.replace(Regex.singleQuote, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
        ].join("; ");
        execSync(`powershell -NoProfile -Command "${psScript}"`, {
          stdio: "pipe",
          timeout: 10000,
        });
        break;

      case "darwin":
        // osascript + built-in: write PNG data from clipboard
        execSync(
          `osascript -e 'set pngData to the clipboard as «class PNGf»' ` +
            `-e 'set fp to open for access POSIX file "${filePath}" with write permission' ` +
            `-e 'write pngData to fp' ` +
            `-e 'close access fp'`,
          { stdio: "pipe", timeout: 10000 },
        );
        break;

      case "linux":
        // xclip: read image/png from clipboard
        execSync(`xclip -selection clipboard -t image/png -o > "${filePath}"`, {
          stdio: "pipe",
          timeout: 10000,
          shell: "/bin/sh",
        });
        break;

      default:
        hostEditor.showError("Lotion: unsupported platform for clipboard image.");
        return undefined;
    }

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
    switch (getPlatform()) {
      case "win32":
        if (isMissingCommandError(err, "powershell")) {
          hostEditor.showError("Lotion: PowerShell not found. Install/enable PowerShell to paste clipboard images.");
          return undefined;
        }
        break;
      case "darwin":
        if (isMissingCommandError(err, "osascript")) {
          hostEditor.showError("Lotion: osascript not found. macOS AppleScript is required for clipboard image paste.");
          return undefined;
        }
        break;
      case "linux":
        if (isMissingCommandError(err, "xclip")) {
          hostEditor.showError("Lotion: xclip not found. Install xclip to paste clipboard images.");
          return undefined;
        }
        break;
    }
    hostEditor.showError("Lotion: no image found on clipboard.");
    return undefined;
  }
}
