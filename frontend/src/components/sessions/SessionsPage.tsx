import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { PhoneIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSession,
  type CallSession,
  type CallSessionDetail,
  type SessionOutcome,
} from "@/lib/api/coach";
import { formatDuration } from "@/lib/phone";

const OUTCOMES: { value: SessionOutcome; label: string }[] = [
  { value: "in_progress", label: "In progress" },
  { value: "connected", label: "Connected" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "callback", label: "Follow up" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "voicemail", label: "Voicemail" },
  { value: "no_answer", label: "No answer" },
];

const OUTCOME_LABEL: Record<SessionOutcome, string> = Object.fromEntries(
  OUTCOMES.map((o) => [o.value, o.label]),
) as Record<SessionOutcome, string>;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function callLength(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  return formatDuration(Math.round((end - start) / 1000));
}

interface SessionsPageProps {
  onGoToSkills: () => void;
}

export function SessionsPage({ onGoToSkills }: SessionsPageProps) {
  const [sessions, setSessions] = useState<CallSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () =>
    listSessions()
      .then(setSessions)
      .catch(() => setError("Couldn't load sessions."));

  useEffect(() => {
    void refresh();
  }, []);

  if (openId) {
    return (
      <SessionDetail
        sessionId={openId}
        onBack={() => {
          setOpenId(null);
          void refresh();
        }}
        onDeleted={() => {
          setOpenId(null);
          void refresh();
        }}
        onError={setError}
      />
    );
  }

  const loading = sessions === null && !error;

  return (
    <div className="search-page">
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="panel">
          <div className="search-loading">
            <span className="spinner" aria-hidden="true" />
            <p>Loading call log…</p>
          </div>
        </div>
      )}

      {sessions && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Call log</h2>
              <p className="results-sub">
                Every dial from the pad lands here. Review outcome, notes, and
                transcript.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setLogging(true)}
            >
              <PlusIcon aria-hidden="true" />
              Log a call
            </button>
          </div>

          {logging && (
            <LogCallForm
              onCancel={() => setLogging(false)}
              onCreated={(session) => {
                setLogging(false);
                setSessions((prev) => (prev ? [session, ...prev] : [session]));
                setOpenId(session.id);
              }}
              onError={setError}
            />
          )}

          {sessions.length === 0 && !logging ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <PhoneIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No calls yet</h3>
              <p className="empty-state__text">
                Click a phone number on Search, Leads, or Follow-up. The coach
                uses{" "}
                <button type="button" className="linklike" onClick={onGoToSkills}>
                  Skills
                </button>{" "}
                docs you turned on.
              </p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Outcome</th>
                    <th>When</th>
                    <th>Length</th>
                    <th className="num">Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      className="lead-table__row--clickable"
                      onClick={() => setOpenId(s.id)}
                    >
                      <td>
                        <span className="lead-name">
                          {s.lead_name || "Untitled call"}
                        </span>
                      </td>
                      <td>
                        <span className={`session-badge session-badge--${s.outcome}`}>
                          {OUTCOME_LABEL[s.outcome]}
                        </span>
                      </td>
                      <td>{formatWhen(s.started_at)}</td>
                      <td>{callLength(s.started_at, s.ended_at)}</td>
                      <td className="num">
                        {s.event_count > 0 ? (
                          `${s.event_count} lines`
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function LogCallForm({
  onCancel,
  onCreated,
  onError,
}: {
  onCancel: () => void;
  onCreated: (session: CallSessionDetail) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const session = await createSession({ lead_name: name.trim() });
      await updateSession(session.id, { ended: true, outcome: "connected" });
      onCreated({ ...session, ended_at: new Date().toISOString(), outcome: "connected" });
    } catch {
      onError("Couldn't log the call.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="session-log-form" onSubmit={(e) => void onSubmit(e)}>
      <label className="settings-field">
        <span className="field-label">Business</span>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who you called"
          autoFocus
        />
      </label>
      <div className="settings-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!name.trim() || saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function SessionDetail({
  sessionId,
  onBack,
  onDeleted,
  onError,
}: {
  sessionId: string;
  onBack: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [session, setSession] = useState<CallSessionDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const loadSession = useCallback(() => {
    getSession(sessionId)
      .then((s) => {
        setSession(s);
        setNotes(s.notes);
      })
      .catch(() => onError("Couldn't load the session."));
  }, [sessionId, onError]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const changeOutcome = async (outcome: SessionOutcome) => {
    if (!session) return;
    setSession({ ...session, outcome });
    try {
      await updateSession(session.id, { outcome });
    } catch {
      onError("Couldn't update the outcome.");
    }
  };

  const saveNotes = async () => {
    if (!session || notes === session.notes) return;
    setSavingNotes(true);
    try {
      const updated = await updateSession(session.id, { notes });
      setSession(updated);
    } catch {
      onError("Couldn't save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const remove = async () => {
    if (!session) return;
    if (!window.confirm("Delete this call? This can't be undone.")) return;
    try {
      await deleteSession(session.id);
      onDeleted();
    } catch {
      onError("Couldn't delete the call.");
    }
  };

  if (!session) {
    return (
      <div className="search-page">
        <div className="panel">
          <div className="search-loading">
            <span className="spinner" aria-hidden="true" />
            <p>Loading call…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-page">
      <section className="panel">
        <div className="panel__header">
          <div>
            <button type="button" className="campaign-back" onClick={onBack}>
              ← All calls
            </button>
            <h2 className="panel__title">{session.lead_name || "Untitled call"}</h2>
            <p className="results-sub">
              {formatWhen(session.started_at)}
              {session.ended_at
                ? ` · ${callLength(session.started_at, session.ended_at)}`
                : ""}
            </p>
          </div>
          <div className="results-actions">
            <select
              className="filter-select"
              value={session.outcome}
              onChange={(e) => void changeOutcome(e.target.value as SessionOutcome)}
              aria-label="Call outcome"
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--ghost" onClick={() => void remove()}>
              <TrashIcon aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>

        <div className="session-grid">
          <div className="session-col">
            <h3 className="session-col__title">Transcript</h3>
            {session.events.length === 0 ? (
              <div className="session-empty">
                <PhoneIcon aria-hidden="true" />
                <p>
                  No transcript. On the next live call, hit Listen on the dial
                  pad to capture the conversation.
                </p>
              </div>
            ) : (
              <ul className="transcript">
                {session.events.map((e) => (
                  <li key={e.id} className={`transcript__row transcript__row--${e.role}`}>
                    <span className="transcript__role">{e.role}</span>
                    <span className="transcript__text">{e.text}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="session-col__title">Notes</h3>
            <textarea
              className="script-step__body"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              placeholder="Who you spoke to, objections, next steps…"
              rows={5}
            />
            {savingNotes && <span className="muted">Saving…</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
