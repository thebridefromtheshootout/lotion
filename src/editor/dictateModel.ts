import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { execFileSync, execSync } from "child_process";
import type { Progress } from "../hostEditor/EditorTypes";
import { isMissingCommandError } from "../core/execErrors";

// ── Model configuration ────────────────────────────────────────────
// Streaming Zipformer model — small, English, good for real-time dictation

const MODEL_NAME = "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";
const MODEL_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_NAME}.tar.bz2`;
const MODEL_DIR_NAME = MODEL_NAME;

/** Resolve the model storage directory (persists across extension reloads). */
function modelBaseDir(): string {
  const home = process.env.USERPROFILE || process.env.HOME || process.env.HOMEPATH || ".";
  return path.join(home, ".lotion", "models");
}

export function modelDir(): string {
  return path.join(modelBaseDir(), MODEL_DIR_NAME);
}

export function isModelReady(): boolean {
  const dir = modelDir();
  // We need tokens.txt + encoder/decoder/joiner onnx files
  return (
    fs.existsSync(path.join(dir, "tokens.txt")) &&
    fs.existsSync(path.join(dir, "encoder-epoch-99-avg-1.onnx")) &&
    fs.existsSync(path.join(dir, "decoder-epoch-99-avg-1.onnx")) &&
    fs.existsSync(path.join(dir, "joiner-epoch-99-avg-1.onnx"))
  );
}

// ── Model download / extract ───────────────────────────────────────

/** Follow redirects and stream to a file. Returns a Promise. */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith("https") ? https.get : http.get;
    const safeUnlink = () => { if (fs.existsSync(dest)) fs.unlinkSync(dest); };
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        safeUnlink();
        return downloadFile(res.headers.location!, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        safeUnlink();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (e) => {
      file.close();
      safeUnlink();
      reject(e);
    });
  });
}

/** Download & extract the streaming ASR model. */
export async function ensureModel(progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
  if (isModelReady()) {
    return;
  }

  const base = modelBaseDir();
  fs.mkdirSync(base, { recursive: true });

  const archivePath = path.join(base, `${MODEL_DIR_NAME}.tar.bz2`);

  // Download
  progress.report({ message: "Downloading speech model (~20 MB)…" });
  await downloadFile(MODEL_URL, archivePath);

  // Extract
  progress.report({ message: "Extracting model…" });
  // tar -xjf works on Windows (Git Bash tar), macOS, Linux
  let tarErr: any;
  let sevenZipErr: any;
  let pythonErr: any;
  try {
    // execFileSync — argv array, no shell, paths can't be reinterpreted.
    execFileSync("tar", ["-xjf", archivePath, "-C", base], { stdio: "ignore" });
  } catch (err: any) {
    tarErr = err;
    // Some Windows installs lack bzip2 support in tar.
    // Fall back to 7z if available, or python
    try {
      // 7z needs a shell because of the pipe between two 7z invocations.
      // archivePath and base are extension-controlled (not user input), so
      // shell interpolation is acceptable here.
      execSync(`7z x "${archivePath}" -so | 7z x -si -ttar -o"${base}"`, { stdio: "ignore" });
    } catch (err2: any) {
      sevenZipErr = err2;
      // python fallback — paths flow through argv, not through string
      // interpolation into python source.
      const pyScript = "import tarfile, sys; tarfile.open(sys.argv[1], 'r:bz2').extractall(sys.argv[2])";
      try {
        execFileSync("python", ["-c", pyScript, archivePath, base], { stdio: "ignore" });
      } catch (err3: any) {
        pythonErr = err3;
      }
    }
  }

  if (!isModelReady() && (tarErr || sevenZipErr || pythonErr)) {
    const missing: string[] = [];
    if (tarErr && isMissingCommandError(tarErr, "tar")) {
      missing.push("tar");
    }
    if (sevenZipErr && isMissingCommandError(sevenZipErr, "7z")) {
      missing.push("7z");
    }
    if (pythonErr && (isMissingCommandError(pythonErr, "python") || isMissingCommandError(pythonErr, "python3"))) {
      missing.push("python");
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing extraction tool(s): ${missing.join(", ")}. Install at least one of tar, 7z, or python to continue.`,
      );
    }
  }

  // Clean up archive
  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  if (!isModelReady()) {
    throw new Error("Model extraction failed — expected files not found in " + modelDir());
  }
}
