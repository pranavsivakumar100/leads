import { useCallback, useRef, useState } from "react";

import { MicIcon } from "@/components/icons";
import {
  addSessionEvent,
  coachNextLine,
  transcribeUtterance,
  type TranscriptTurn,
} from "@/lib/api/coach";
import {
  callTranscriptSupported,
  useCallTranscript,
  type TranscriptRole,
} from "@/hooks/useCallTranscript";
import { useDialer } from "@/hooks/useDialer";

interface LiveTurn extends TranscriptTurn {
  key: number;
}

export function DialCoach({ sessionId }: { sessionId: string }) {
  const { status, localStream, remoteStream } = useDialer();
  const live = status === "open";

  const [wantListen, setWantListen] = useState(true);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [autoCoach, setAutoCoach] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef(Date.now());
  const keyRef = useRef(0);
  const transcriptRef = useRef<LiveTurn[]>(turns);
  transcriptRef.current = turns;

  const requestCoach = useCallback(async () => {
    if (coaching) return;
    setCoaching(true);
    setError(null);
    try {
      const res = await coachNextLine(
        sessionId,
        transcriptRef.current.map(({ role, text }) => ({ role, text })),
      );
      setSuggestion(res.text);
    } catch (e) {
      const msg =
        e instanceof Error && e.message.toLowerCase().includes("openai")
          ? "Add your OpenAI key in Settings to use the coach."
          : "Couldn't get a suggestion.";
      setError(msg);
    } finally {
      setCoaching(false);
    }
  }, [coaching, sessionId]);

  const autoCoachRef = useRef(autoCoach);
  autoCoachRef.current = autoCoach;
  const requestCoachRef = useRef(requestCoach);
  requestCoachRef.current = requestCoach;

  const handleUtterance = useCallback(
    (role: TranscriptRole, text: string) => {
      const turn: LiveTurn = { role, text, key: keyRef.current++ };
      setTurns((prev) => [...prev, turn]);
      void addSessionEvent(sessionId, {
        role,
        text,
        t_ms: Date.now() - startedAtRef.current,
      }).catch(() => undefined);
      if (role === "prospect" && autoCoachRef.current) {
        setTimeout(() => void requestCoachRef.current(), 0);
      }
    },
    [sessionId],
  );

  const transcribe = useCallback(
    async (_role: TranscriptRole, blob: Blob, filename: string) =>
      transcribeUtterance(sessionId, blob, filename),
    [sessionId],
  );

  const { listening, hearing, error: sttError } = useCallTranscript({
    localStream: live ? localStream : null,
    remoteStream: live ? remoteStream : null,
    enabled: live && wantListen,
    onUtterance: handleUtterance,
    transcribe,
  });

  const supported = callTranscriptSupported();
  const waitingForAudio = live && wantListen && !localStream && !remoteStream;
  const hearingLabel =
    hearing === "rep"
      ? "Hearing you…"
      : hearing === "prospect"
        ? "Hearing them…"
        : waitingForAudio
          ? "Waiting for call audio…"
          : listening
            ? "Listening to both sides"
            : live
              ? "Paused"
              : "Connects when they pick up";

  return (
    <div className="dial-coach">
      {(error || sttError) && (
        <p className="dial-coach__error">{error ?? sttError}</p>
      )}
      <div className="dial-coach__suggestion" aria-live="polite">
        {coaching ? (
          <span className="coach-panel__thinking">
            <span className="spinner spinner--sm" aria-hidden="true" />
            Thinking…
          </span>
        ) : suggestion ? (
          <p className="dial-coach__text">{suggestion}</p>
        ) : (
          <p className="dial-coach__placeholder">
            Coach reads both sides of the call and Skills docs you turned on.
          </p>
        )}
      </div>
      <div className="dial-coach__controls">
        {!wantListen ? (
          <button
            type="button"
            className="btn btn--secondary dial-coach__btn"
            onClick={() => setWantListen(true)}
            disabled={!supported || !live}
          >
            <MicIcon aria-hidden="true" />
            {supported ? "Listen" : "No audio"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--secondary dial-coach__btn"
            onClick={() => setWantListen(false)}
            disabled={!live}
          >
            <MicIcon aria-hidden="true" />
            Pause
          </button>
        )}
        <span
          className={`dial-coach__hearing${hearing ? " dial-coach__hearing--live" : ""}`}
        >
          {hearingLabel}
        </span>
        <label className="dial-coach__auto">
          <input
            type="checkbox"
            checked={autoCoach}
            onChange={(e) => setAutoCoach(e.target.checked)}
          />
          Auto
        </label>
      </div>
      <button
        type="button"
        className="btn btn--secondary dial-coach__ask"
        onClick={() => void requestCoach()}
        disabled={coaching}
      >
        Suggest next line
      </button>
      {turns.length > 0 && (
        <div
          className={`dial-coach__last transcript__row--${turns[turns.length - 1].role}`}
        >
          <span className="transcript__role">
            {turns[turns.length - 1].role === "rep" ? "Me" : "Prospect"}
          </span>
          <span className="transcript__text">
            {turns[turns.length - 1].text}
          </span>
        </div>
      )}
    </div>
  );
}
