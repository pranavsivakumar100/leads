import { useCallback, useEffect, useRef, useState } from "react";

export type TranscriptRole = "rep" | "prospect";

interface UseCallTranscriptOptions {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  enabled: boolean;
  onUtterance: (role: TranscriptRole, text: string) => void;
  transcribe: (role: TranscriptRole, blob: Blob, filename: string) => Promise<string>;
}

const TICK_MS = 50;
const START_MS = 140;
const END_SILENCE_MS = 800;
const MAX_UTTERANCE_MS = 14000;
const MIN_BLOB_BYTES = 900;

function pickMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

function rms(analyser: AnalyserNode, buf: Uint8Array): number {
  analyser.getByteTimeDomainData(
    buf as Parameters<AnalyserNode["getByteTimeDomainData"]>[0],
  );
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const n = (buf[i] - 128) / 128;
    sum += n * n;
  }
  return Math.sqrt(sum / buf.length);
}

function watchChannel(
  stream: MediaStream,
  threshold: number,
  onSpeaking: (active: boolean) => void,
  onBlob: (blob: Blob, mime: string) => void,
): () => void {
  if (typeof MediaRecorder === "undefined") {
    return () => undefined;
  }
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) return () => undefined;

  const recStream = new MediaStream(audioTracks);
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(recStream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.35;
  source.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const mime = pickMime();

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let speechMs = 0;
  let silenceMs = 0;
  let recMs = 0;
  let hearing = false;

  const setHearing = (next: boolean) => {
    if (hearing === next) return;
    hearing = next;
    onSpeaking(next);
  };

  const startRec = () => {
    if (recorder) return;
    chunks = [];
    recMs = 0;
    const rec = new MediaRecorder(recStream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      chunks = [];
      recorder = null;
      setHearing(false);
      if (blob.size >= MIN_BLOB_BYTES) onBlob(blob, type);
    };
    rec.start();
    recorder = rec;
    setHearing(true);
  };

  const stopRec = () => {
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const timer = window.setInterval(() => {
    if (ctx.state === "suspended") void ctx.resume();
    const level = rms(analyser, buf);
    if (level >= threshold) {
      speechMs += TICK_MS;
      silenceMs = 0;
      if (!recorder && speechMs >= START_MS) startRec();
      if (recorder) recMs += TICK_MS;
      if (recorder && recMs >= MAX_UTTERANCE_MS) stopRec();
    } else {
      speechMs = 0;
      if (recorder) {
        silenceMs += TICK_MS;
        recMs += TICK_MS;
        if (silenceMs >= END_SILENCE_MS) stopRec();
      }
    }
  }, TICK_MS);

  return () => {
    window.clearInterval(timer);
    setHearing(false);
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        void ctx.close();
      };
      recorder.stop();
    } else {
      void ctx.close();
    }
  };
}

export const callTranscriptSupported = (): boolean =>
  typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined";

/**
 * Dual-channel STT: Twilio local stream = you, remote stream = prospect.
 * Web Speech API cannot attach to those streams, so we clip on VAD and send
 * each utterance to Whisper.
 */
export function useCallTranscript({
  localStream,
  remoteStream,
  enabled,
  onUtterance,
  transcribe,
}: UseCallTranscriptOptions) {
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState<TranscriptRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const transcribeRef = useRef(transcribe);
  transcribeRef.current = transcribe;
  const hearingRef = useRef({ rep: false, prospect: false });
  const queuesRef = useRef<{ rep: Promise<void>; prospect: Promise<void> }>({
    rep: Promise.resolve(),
    prospect: Promise.resolve(),
  });

  const pushHearing = useCallback((role: TranscriptRole, active: boolean) => {
    hearingRef.current[role] = active;
    if (hearingRef.current.prospect) setHearing("prospect");
    else if (hearingRef.current.rep) setHearing("rep");
    else setHearing(null);
  }, []);

  const enqueue = useCallback((role: TranscriptRole, blob: Blob, mime: string) => {
    const filename = `${role}.${extFor(mime)}`;
    const run = async () => {
      try {
        const text = await transcribeRef.current(role, blob, filename);
        if (text) onUtteranceRef.current(role, text);
        setError(null);
      } catch (err) {
        const msg =
          err instanceof Error && /openai/i.test(err.message)
            ? "Add your OpenAI key in Settings to transcribe the call."
            : err instanceof Error
              ? err.message
              : "Couldn't transcribe that clip.";
        setError(msg);
      }
    };
    queuesRef.current[role] = queuesRef.current[role].then(run, run);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setListening(false);
      setHearing(null);
      hearingRef.current = { rep: false, prospect: false };
      return;
    }
    if (!callTranscriptSupported()) {
      setError("This browser can't capture call audio. Use Chrome.");
      setListening(false);
      return;
    }
    if (!localStream && !remoteStream) {
      setListening(false);
      return;
    }

    setListening(true);
    setError(null);
    const stops: Array<() => void> = [];
    if (localStream) {
      stops.push(
        watchChannel(
          localStream,
          0.02,
          (active) => pushHearing("rep", active),
          (blob, mime) => enqueue("rep", blob, mime),
        ),
      );
    }
    if (remoteStream) {
      stops.push(
        watchChannel(
          remoteStream,
          0.012,
          (active) => pushHearing("prospect", active),
          (blob, mime) => enqueue("prospect", blob, mime),
        ),
      );
    }
    return () => {
      stops.forEach((stop) => stop());
      setListening(false);
      setHearing(null);
      hearingRef.current = { rep: false, prospect: false };
    };
  }, [enabled, localStream, remoteStream, enqueue, pushHearing]);

  return { listening, hearing, error };
}
