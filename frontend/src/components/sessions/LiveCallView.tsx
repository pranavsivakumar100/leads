import { useCallback, useEffect, useRef, useState } from "react";

import { MicIcon, PhoneIcon } from "@/components/icons";
import {
  addSessionEvent,
  coachNextLine,
  type CallSessionDetail,
  type Script,
  type TranscriptTurn,
} from "@/lib/api/coach";
import { speechSupported, useSpeech } from "@/hooks/useSpeech";

type Speaker = "rep" | "prospect";

interface LiveTurn extends TranscriptTurn {
  key: number;
}

interface LiveCallViewProps {
  session: CallSessionDetail;
  script: Script | null;
  onEnd: () => void;
}

export function LiveCallView({ session, script, onEnd }: LiveCallViewProps) {
  const [speaker, setSpeaker] = useState<Speaker>("rep");
  const [turns, setTurns] = useState<LiveTurn[]>(() =>
    session.events
      .filter((e) => e.role === "rep" || e.role === "prospect")
      .map((e, i) => ({ role: e.role as Speaker, text: e.text, key: i })),
  );
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [autoCoach, setAutoCoach] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef(Date.now());
  const keyRef = useRef(turns.length);
  const speakerRef = useRef<Speaker>(speaker);
  speakerRef.current = speaker;
  const transcriptRef = useRef<LiveTurn[]>(turns);
  transcriptRef.current = turns;

  const requestCoach = useCallback(async () => {
    if (coaching) return;
    setCoaching(true);
    setError(null);
    try {
      const res = await coachNextLine(
        session.id,
        transcriptRef.current.map(({ role, text }) => ({ role, text })),
      );
      setSuggestion(res.text);
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes("not configured")
          ? "AI coach isn't configured yet — set OPENAI_API_KEY on the backend."
          : "Couldn't get a suggestion. Try again.";
      setError(msg);
    } finally {
      setCoaching(false);
    }
  }, [coaching, session.id]);

  const autoCoachRef = useRef(autoCoach);
  autoCoachRef.current = autoCoach;
  const requestCoachRef = useRef(requestCoach);
  requestCoachRef.current = requestCoach;

  const handleFinal = useCallback(
    (text: string) => {
      const role = speakerRef.current;
      const turn: LiveTurn = { role, text, key: keyRef.current++ };
      setTurns((prev) => [...prev, turn]);

      // Fire-and-forget persistence; the live UI is the source of truth mid-call.
      void addSessionEvent(session.id, {
        role,
        text,
        t_ms: Date.now() - startedAtRef.current,
      }).catch(() => undefined);

      if (role === "prospect" && autoCoachRef.current) {
        // Let the state update land first so the ref holds the new turn.
        setTimeout(() => void requestCoachRef.current(), 0);
      }
    },
    [session.id],
  );

  const { listening, interim, error: micError, start, stop } = useSpeech({
    onFinal: handleFinal,
  });

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, interim]);

  const endCall = () => {
    stop();
    onEnd();
  };

  const supported = speechSupported();

  return (
    <div className="live-call">
      <div className="live-call__header">
        <div>
          <h2 className="panel__title">{session.lead_name || "Live call"}</h2>
          {session.offer && <p className="results-sub">{session.offer}</p>}
        </div>
        <button type="button" className="btn btn--danger" onClick={endCall}>
          <PhoneIcon aria-hidden="true" />
          End call
        </button>
      </div>

      {(error || micError) && (
        <div className="alert alert--error" role="alert">
          {error ?? micError}
        </div>
      )}

      <div className="live-call__grid">
        {/* Left: mic controls + live transcript */}
        <div className="live-call__col">
          <div className="live-call__controls">
            {!listening ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={start}
                disabled={!supported}
              >
                <MicIcon aria-hidden="true" />
                {supported ? "Start listening" : "Mic not supported"}
              </button>
            ) : (
              <button type="button" className="btn btn--secondary" onClick={stop}>
                <MicIcon aria-hidden="true" />
                Pause mic
              </button>
            )}

            <div className="speaker-toggle" role="group" aria-label="Who is speaking">
              <button
                type="button"
                className={`speaker-toggle__btn${speaker === "rep" ? " speaker-toggle__btn--active" : ""}`}
                onClick={() => setSpeaker("rep")}
              >
                Me
              </button>
              <button
                type="button"
                className={`speaker-toggle__btn${speaker === "prospect" ? " speaker-toggle__btn--active" : ""}`}
                onClick={() => setSpeaker("prospect")}
              >
                Prospect
              </button>
            </div>

            {listening && (
              <span className="live-dot" aria-label="Listening">
                <span className="live-dot__pulse" />
                Listening
              </span>
            )}
          </div>

          <div className="live-transcript">
            {turns.length === 0 && !interim && (
              <p className="live-transcript__hint">
                Put the call on speaker, hit <strong>Start listening</strong>,
                and toggle who's talking. Everything is saved to the session.
              </p>
            )}
            {turns.map((t) => (
              <div key={t.key} className={`transcript__row transcript__row--${t.role}`}>
                <span className="transcript__role">
                  {t.role === "rep" ? "Me" : "Prospect"}
                </span>
                <span className="transcript__text">{t.text}</span>
              </div>
            ))}
            {interim && (
              <div className={`transcript__row transcript__row--${speaker}`}>
                <span className="transcript__role">
                  {speaker === "rep" ? "Me" : "Prospect"}
                </span>
                <span className="transcript__text live-transcript__interim">
                  {interim}
                </span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Right: coach + script */}
        <div className="live-call__col live-call__col--coach">
          <div className="coach-panel">
            <div className="coach-panel__head">
              <h3 className="session-col__title">Coach</h3>
              <label className="filter-bar__toggle">
                <input
                  type="checkbox"
                  checked={autoCoach}
                  onChange={(e) => setAutoCoach(e.target.checked)}
                />
                Auto after prospect speaks
              </label>
            </div>

            <div className="coach-panel__suggestion" aria-live="polite">
              {coaching ? (
                <span className="coach-panel__thinking">
                  <span className="spinner spinner--sm" aria-hidden="true" />
                  Thinking…
                </span>
              ) : suggestion ? (
                <p className="coach-panel__text">{suggestion}</p>
              ) : (
                <p className="coach-panel__placeholder">
                  Suggestions appear here — say your opener or ask for one.
                </p>
              )}
            </div>

            <button
              type="button"
              className="btn btn--secondary coach-panel__ask"
              onClick={() => void requestCoach()}
              disabled={coaching}
            >
              Suggest next line
            </button>
          </div>

          {script && (
            <div className="script-reference live-call__script">
              <h3 className="session-col__title">{script.name}</h3>
              {script.steps.map((step, i) => (
                <div key={i} className="script-reference__step">
                  <div className="script-reference__step-title">
                    {step.title || `Step ${i + 1}`}
                  </div>
                  <div className="script-reference__step-body">{step.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
