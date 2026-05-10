import { Position, ProgressLocation, Uri, ViewColumn } from "../hostEditor/EditorTypes";
import type { TextDocument, WebviewPanel } from "../hostEditor/EditorTypes";
import { hostEditor } from "../hostEditor/HostingEditor";
import { ExtensionToDictatePanelCommunicator } from "../communicators/dictatePanelCommunicator";

import { ensureModel } from "./dictateModel";
import {
  destroyRecognizer,
  getOrCreateRecognizer,
  recreateStream,
  resetStream,
} from "./dictateRecognizer";

// ── Webview panel state ────────────────────────────────────────────

let dictatePanel: WebviewPanel | undefined;
let dictateCommunicator: ExtensionToDictatePanelCommunicator | undefined;

// ── /dictate handler ───────────────────────────────────────────────

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
      recreateStream();
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
    recreateStream();
  });

  dictatePanel.onDidDispose(() => {
    dictatePanel = undefined;
    dictateCommunicator = undefined;
    destroyRecognizer();
  });
}
