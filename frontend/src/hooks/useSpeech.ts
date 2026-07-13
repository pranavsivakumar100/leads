import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => getRecognitionCtor() !== null;

interface UseSpeechOptions {
  /** Called with each finalized utterance. */
  onFinal: (text: string) => void;
}

/**
 * Continuous mic transcription via the browser's Web Speech API.
 * Zero-cost prototype path: laptop mic on speakerphone, single channel.
 */
export function useSpeech({ onFinal }: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRunRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition isn't supported in this browser. Use Chrome.");
      return;
    }
    if (recRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          onFinalRef.current(text);
        } else {
          interimText += ` ${text}`;
        }
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access was denied. Allow the mic and try again.");
        shouldRunRef.current = false;
        setListening(false);
      }
      // "no-speech" and "aborted" are routine; onend handles the restart.
    };

    // Chrome stops recognition after silence; restart while active.
    rec.onend = () => {
      if (shouldRunRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };

    shouldRunRef.current = true;
    recRef.current = rec;
    setError(null);
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => stop, [stop]);

  return { listening, interim, error, start, stop };
}
