
import { Position, ProgressLocation, Uri, ViewColumn } from "../hostEditor/EditorTypes";
import type { Progress, TextDocument, WebviewPanel } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { execSync } from "child_process";
import { getExtensionUri, getWebviewShellHtml } from "../core/webviewShell";
import { ExtensionToDictatePanelCommunicator } from "../communicators/dictatePanelCommunicator";

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

function modelDir(): string {
  return path.join(modelBaseDir(), MODEL_DIR_NAME);
}

function isModelReady(): boolean {
  const dir = modelDir();
  // We need tokens.txt + encoder/decoder/joiner onnx files
  return (
    fs.existsSync(path.join(dir, "tokens.txt")) &&
    fs.existsSync(path.join(dir, "encoder-epoch-99-avg-1.onnx")) &&
    fs.existsSync(path.join(dir, "decoder-epoch-99-avg-1.onnx")) &&
    fs.existsSync(path.join(dir, "joiner-epoch-99-avg-1.onnx"))
  );
}

// ── Model download helpers ─────────────────────────────────────────

/** Follow redirects and stream to a file. Returns a Promise. */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location!, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (e) => {
      file.close();
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      reject(e);
    });
  });
}

/** Download & extract the streaming ASR model. */
async function ensureModel(progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
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
  try {
    execSync(`tar -xjf "${archivePath}" -C "${base}"`, { stdio: "ignore" });
  } catch {
    // Some Windows installs lack bzip2 support in tar.
    // Fall back to 7z if available, or python
    try {
      execSync(`7z x "${archivePath}" -so | 7z x -si -ttar -o"${base}"`, { stdio: "ignore" });
    } catch {
      // python fallback
      execSync(`python -c "import tarfile; tarfile.open(r'${archivePath}','r:bz2').extractall(r'${base}')"`, {
        stdio: "ignore",
      });
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

// ── Recognizer singleton ───────────────────────────────────────────
let recognizer: any = null;
let recognizerStream: any = null;

function getOrCreateRecognizer(): { recognizer: any; stream: any } {
  if (recognizer) {
    return { recognizer, stream: recognizerStream };
  }

  const sherpa = require("sherpa-onnx-node");
  const dir = modelDir();

  recognizer = new sherpa.OnlineRecognizer({
    modelConfig: {
      transducer: {
        encoder: path.join(dir, "encoder-epoch-99-avg-1.onnx"),
        decoder: path.join(dir, "decoder-epoch-99-avg-1.onnx"),
        joiner: path.join(dir, "joiner-epoch-99-avg-1.onnx"),
      },
      tokens: path.join(dir, "tokens.txt"),
      numThreads: 2,
      provider: "cpu",
      debug: false,
    },
    decodingMethod: "greedy_search",
    enableEndpoint: true,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.2,
    rule3MinUtteranceLength: 20,
  });

  recognizerStream = recognizer.createStream();
  return { recognizer, stream: recognizerStream };
}

function resetStream(): void {
  if (recognizer && recognizerStream) {
    recognizer.reset(recognizerStream);
  }
}

function destroyRecognizer(): void {
  recognizer = null;
  recognizerStream = null;
}

// ── Webview panel ──────────────────────────────────────────────────
let dictatePanel: WebviewPanel | undefined;
let dictateCommunicator: ExtensionToDictatePanelCommunicator | undefined;

export async function handleDictateCommand(doc: TextDocument, pos: Position): Promise<void> {
  // If panel already exists, just reveal it
  if (dictatePanel) {
    dictatePanel.reveal(ViewColumn.One);
    dictateCommunicator?.sendSetTarget(doc.uri.toString(), pos.line, pos.character);
    return;
  }

  // Ensure model is downloaded
  try {
    await hostEditor.withProgress(
      { location: ProgressLocation.Notification, cancellable: false, title: "Lotion Dictation" },
      (progress) => ensureModel(progress),
    );
  } catch (err: any) {
    hostEditor.showError(`Lotion: Failed to prepare speech model — ${err.message}`);
    return;
  }

  // Pre-init recognizer before opening the webview
  try {
    getOrCreateRecognizer();
  } catch (err: any) {
    hostEditor.showError(`Lotion: Failed to initialise recogniser — ${err.message}`);
    return;
  }

  dictatePanel = hostEditor.createWebviewPanel("lotionDictate", "🎤 Dictate", "dictateApp", ViewColumn.One);

  let targetDocUri = doc.uri.toString();
  let targetLine = pos.line;
  let targetChar = pos.character;
  let accumulatedText = "";

  const communicator = new ExtensionToDictatePanelCommunicator(dictatePanel.webview);
  dictateCommunicator = communicator;

  communicator.registerOnAudioData((msg) => {
    const samples = new Float32Array(msg.samples);
    try {
      const { recognizer: rec, stream } = getOrCreateRecognizer();
      stream.acceptWaveform({ samples, sampleRate: 16000 });

      while (rec.isReady(stream)) {
        rec.decode(stream);
      }

      const result = rec.getResult(stream);
      const text: string = result.text || "";

      if (rec.isEndpoint(stream)) {
        if (text.trim()) {
          accumulatedText += (accumulatedText ? " " : "") + text.trim();
        }
        rec.reset(stream);
        communicator.sendResult("", accumulatedText);
      } else {
        communicator.sendResult(text, accumulatedText);
      }
    } catch (err: any) {
      communicator.sendError(err.message);
    }
  });

  communicator.registerOnStop(() => {
    try {
      const { recognizer: rec, stream } = getOrCreateRecognizer();
      stream.inputFinished();
      while (rec.isReady(stream)) {
        rec.decode(stream);
      }
      const result = rec.getResult(stream);
      const text: string = result.text || "";
      if (text.trim()) {
        accumulatedText += (accumulatedText ? " " : "") + text.trim();
      }
      resetStream();
      recognizerStream = recognizer.createStream();
    } catch {
      // Ignore finalization errors
    }
    communicator.sendResult("", accumulatedText);
  });

  communicator.registerOnInsert(async (msg) => {
    const textToInsert = msg.text;
    if (!textToInsert.trim()) {
      return;
    }
    try {
      const targetDoc = await hostEditor.openTextDocument(Uri.parse(targetDocUri));
      await hostEditor.showTextDocument(targetDoc);
      const insertPos = new Position(targetLine, targetChar);
      await hostEditor.insertAt(insertPos, textToInsert);
      const lines = textToInsert.split("\n");
      if (lines.length === 1) {
        targetChar += textToInsert.length;
      } else {
        targetLine += lines.length - 1;
        targetChar = lines[lines.length - 1].length;
      }
      accumulatedText = "";
      communicator.sendInserted();
    } catch (err: any) {
      hostEditor.showError(`Lotion: Insert failed — ${err.message}`);
    }
  });

  communicator.registerOnClear(() => {
    accumulatedText = "";
    resetStream();
    recognizerStream = recognizer.createStream();
  });

  dictatePanel.onDidDispose(() => {
    dictatePanel = undefined;
    dictateCommunicator = undefined;
    destroyRecognizer();
  });
}
