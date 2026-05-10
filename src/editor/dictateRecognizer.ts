import * as path from "path";
import { modelDir } from "./dictateModel";

// ── Recognizer singleton ───────────────────────────────────────────
//
// sherpa-onnx-node holds native handles; keep a single recognizer per
// extension host and a single live stream that handlers can reset or
// recreate as utterances finalize.

let recognizer: any = null;
let recognizerStream: any = null;

export function getOrCreateRecognizer(): { recognizer: any; stream: any } {
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

export function resetStream(): void {
  if (recognizer && recognizerStream) {
    recognizer.reset(recognizerStream);
  }
}

/** Close the current stream and start a fresh one. Used after /clear or finalize. */
export function recreateStream(): void {
  if (recognizer) {
    recognizerStream = recognizer.createStream();
  }
}

export function destroyRecognizer(): void {
  recognizer = null;
  recognizerStream = null;
}
