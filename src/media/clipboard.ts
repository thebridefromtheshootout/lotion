
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// ── Platform detection ─────────────────────────────────────────────

type Platform = "win32" | "darwin" | "linux";

function getPlatform(): Platform {
  return process.platform as Platform;
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
        return /«class PNGf»|«class TIFF»|public\.png|public\.tiff/.test(result);

      case "linux":
        // xclip: list clipboard targets and check for image types
        const targets = execSync("xclip -selection clipboard -t TARGETS -o", {
          stdio: "pipe",
          timeout: 5000,
          encoding: "utf-8",
        });
        return /image\/png|image\/jpeg|image\/bmp/.test(targets);

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
          `$img.Save('${filePath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
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
  } catch (err) {
    // Clean up partial file on failure
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    hostEditor.showError("Lotion: no image found on clipboard.");
    return undefined;
  }
}
