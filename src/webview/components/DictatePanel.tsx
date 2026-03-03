import React, { useState, useEffect, useRef, useCallback } from "react";
import { DictatePanelToExtensionCommunicator } from "../communicators/DictatePanelToExtensionCommunicator";

const communicator = new DictatePanelToExtensionCommunicator();

export function DictatePanel() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [accumulated, setAccumulated] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  // Keep recordingRef in sync for use in animation frame callback
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // ── Host message listener ──────────────────────────────────────
  useEffect(() => {
    communicator.registerOnResult((msg) => {
      setAccumulated(msg.accumulated || "");
      setPartial(msg.partial ? " " + msg.partial : "");
    });

    communicator.registerOnInserted(() => {
      setAccumulated("");
      setPartial("");
      setStatus("Inserted ✓");
      setTimeout(() => {
        setStatus((prev) => (prev === "Inserted ✓" ? (recordingRef.current ? "Listening…" : "Ready") : prev));
      }, 1500);
    });

    communicator.registerOnError((msg) => {
      setError(msg.message);
    });

    communicator.registerOnSetTarget(() => {
      // Handled by extension host side
    });
  }, []);

  // ── Waveform drawing ───────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    if (!recordingRef.current || !analyserRef.current || !canvasRef.current) return;
    animFrameRef.current = requestAnimationFrame(drawWaveform);

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(data);

    const w = (canvas.width = canvas.clientWidth);
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;

    const style = getComputedStyle(document.documentElement);
    ctx.strokeStyle = style.getPropertyValue("--vscode-charts-blue") || "#4fc3f7";
    ctx.beginPath();

    const sliceW = w / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }, []);

  // ── Start recording ────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Microphone API unavailable. VS Code webviews may not support microphone access in some configurations. " +
          "Ensure VS Code has microphone permission in your OS settings.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
    } catch (e: any) {
      let hint = "";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        hint =
          " Fix: Grant microphone permission to VS Code in your operating system settings." +
          " macOS: System Preferences → Privacy & Security → Microphone → enable Visual Studio Code." +
          " Windows: Settings → Privacy → Microphone → Allow desktop apps to access your microphone." +
          " Linux: Check PipeWire / PulseAudio permissions for the Electron / Code process.";
      } else if (e.name === "NotFoundError") {
        hint = " No microphone device found. Please connect a microphone and try again.";
      }
      setError("Microphone access denied: " + e.message + hint);
      return;
    }

    const actx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = actx;
    const source = actx.createMediaStreamSource(mediaStreamRef.current!);
    sourceRef.current = source;

    const analyser = actx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const processor = actx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      communicator.sendAudioData(Array.from(input));
    };
    source.connect(processor);
    processor.connect(actx.destination);
    processorRef.current = processor;

    setRecording(true);
    recordingRef.current = true;
    setStatus("Listening…");
    setError("");
    drawWaveform();
  }, [drawWaveform]);

  // ── Stop recording ─────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    setRecording(false);
    recordingRef.current = false;

    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setStatus("Stopped");
    communicator.sendStop();

    // Clear waveform
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else startRecording();
  }, [recording, startRecording, stopRecording]);

  const clearTranscript = useCallback(() => {
    setAccumulated("");
    setPartial("");
    communicator.sendClear();
  }, []);

  const insertText = useCallback(() => {
    const text = (accumulated + (partial ? " " + partial : "")).trim();
    if (!text) return;
    communicator.sendInsert(text);
  }, [accumulated, partial]);

  const hasText = accumulated.trim() || partial.trim();

  return (
    <>
      <h2>🎤 Dictation</h2>

      <div className="controls">
        <button className={recording ? "recording" : undefined} onClick={toggleRecording}>
          {recording ? "⏹ Stop" : "⏺ Record"}
        </button>
        <span className="status">{status}</span>
      </div>

      <canvas ref={canvasRef} className="waveform" height={60} />

      <div className="transcript-box">
        <span className="accumulated">{accumulated}</span>
        <span className="partial">{partial}</span>
      </div>

      <div className="actions">
        <button onClick={clearTranscript}>Clear</button>
        <button className="primary" onClick={insertText} disabled={!hasText}>
          Insert ⏎
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      <div className="hint">
        Tip: Speak naturally. Click Insert to paste into your document. The model runs fully offline.
      </div>
    </>
  );
}
