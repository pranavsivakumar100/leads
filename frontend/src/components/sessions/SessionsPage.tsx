import { useCallback, useEffect, useMemo, useState } from "react";

import { MicIcon, PhoneIcon, PlusIcon, TrashIcon } from "@/components/icons";

import { LiveCallView } from "./LiveCallView";
import {
  createSession,
  deleteSession,
  getSession,
  listOffers,
  listScripts,
  listSessions,
  updateSession,
  type CallSession,
  type CallSessionDetail,
  type Offer,
  type Script,
  type SessionOutcome,
} from "@/lib/api/coach";
import { listLibraryLeads, type LibraryLead } from "@/lib/api/leads";

const OUTCOMES: { value: SessionOutcome; label: string }[] = [
  { value: "in_progress", label: "In progress" },
  { value: "connected", label: "Connected" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "callback", label: "Callback" },
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

interface SessionsPageProps {
  onGoToScripts: () => void;
}

export function SessionsPage({ onGoToScripts }: SessionsPageProps) {
  const [sessions, setSessions] = useState<CallSession[] | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [leads, setLeads] = useState<LibraryLead[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () =>
    listSessions()
      .then(setSessions)
      .catch(() => setError("Couldn't load sessions."));

  useEffect(() => {
    void refresh();
    listScripts().then(setScripts).catch(() => undefined);
    listOffers().then(setOffers).catch(() => undefined);
    listLibraryLeads().then(setLeads).catch(() => undefined);
  }, []);

  const scriptName = (id: string | null) =>
    id ? scripts.find((s) => s.id === id)?.name ?? "Deleted script" : null;

  if (openId) {
    return (
      <SessionDetail
        sessionId={openId}
        scripts={scripts}
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
            <p>Loading sessions…</p>
          </div>
        </div>
      )}

      {sessions && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Call sessions</h2>
              <p className="results-sub">
                A record of each call — review the outcome, notes, and (soon) the
                live coaching transcript.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setCreating(true)}
            >
              <PlusIcon aria-hidden="true" />
              New session
            </button>
          </div>

          {creating && (
            <NewSessionForm
              leads={leads}
              scripts={scripts}
              offers={offers}
              onCancel={() => setCreating(false)}
              onCreated={(session) => {
                setCreating(false);
                setSessions((prev) => (prev ? [session, ...prev] : [session]));
                setOpenId(session.id);
              }}
              onError={setError}
            />
          )}

          {sessions.length === 0 && !creating ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <PhoneIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No sessions yet</h3>
              <p className="empty-state__text">
                Start a session before a call to keep notes and outcome in one
                place. Live AI coaching will attach here next.
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={() => setCreating(true)}
              >
                <PlusIcon aria-hidden="true" />
                New session
              </button>
            </div>
          ) : sessions.length > 0 ? (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Script</th>
                    <th>Outcome</th>
                    <th>When</th>
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
                      <td>{scriptName(s.script_id) ?? <span className="muted">—</span>}</td>
                      <td>
                        <span className={`session-badge session-badge--${s.outcome}`}>
                          {OUTCOME_LABEL[s.outcome]}
                        </span>
                      </td>
                      <td>{formatWhen(s.started_at)}</td>
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

      {sessions && sessions.length > 0 && scripts.length === 0 && (
        <p className="results-sub" style={{ marginTop: 12 }}>
          Tip: create a{" "}
          <button type="button" className="linklike" onClick={onGoToScripts}>
            call script
          </button>{" "}
          so the coach has a framework to follow.
        </p>
      )}
    </div>
  );
}

interface NewSessionFormProps {
  leads: LibraryLead[];
  scripts: Script[];
  offers: Offer[];
  onCancel: () => void;
  onCreated: (session: CallSessionDetail) => void;
  onError: (msg: string) => void;
}

function offerToText(offer: Offer): string {
  return [offer.name, offer.description, offer.pricing]
    .filter(Boolean)
    .join(" — ");
}

function NewSessionForm({
  leads,
  scripts,
  offers,
  onCancel,
  onCreated,
  onError,
}: NewSessionFormProps) {
  const [leadPlaceId, setLeadPlaceId] = useState("");
  const [manualName, setManualName] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [offer, setOffer] = useState(
    () => localStorage.getItem("leadflow:lastOffer") ?? "",
  );
  const [saving, setSaving] = useState(false);

  const selectedLead = useMemo(
    () => leads.find((l) => l.place_id === leadPlaceId) ?? null,
    [leads, leadPlaceId],
  );

  const submit = async () => {
    if (saving) return;
    const leadName = selectedLead?.name ?? manualName.trim();
    setSaving(true);
    try {
      const session = await createSession({
        lead_place_id: selectedLead?.place_id ?? "",
        lead_name: leadName,
        script_id: scriptId || null,
        offer: offer.trim(),
      });
      if (offer.trim()) {
        localStorage.setItem("leadflow:lastOffer", offer.trim());
      }
      onCreated(session);
    } catch {
      onError("Couldn't start the session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="new-session">
      <div className="new-session__row">
        <label className="field-label">Lead</label>
        {leads.length > 0 ? (
          <select
            className="filter-select"
            value={leadPlaceId}
            onChange={(e) => setLeadPlaceId(e.target.value)}
          >
            <option value="">Manual entry…</option>
            {leads.map((l) => (
              <option key={l.place_id} value={l.place_id}>
                {l.name}
                {l.phone ? ` · ${l.phone}` : ""}
              </option>
            ))}
          </select>
        ) : null}
        {!leadPlaceId && (
          <input
            className="text-input"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Business name"
          />
        )}
      </div>

      <div className="new-session__row">
        <label className="field-label">Script</label>
        <select
          className="filter-select"
          value={scriptId}
          onChange={(e) => setScriptId(e.target.value)}
        >
          <option value="">No script</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="new-session__row">
        <label className="field-label">Offer — what you're selling</label>
        {offers.length > 0 && (
          <select
            className="filter-select"
            value=""
            onChange={(e) => {
              const picked = offers.find((o) => o.id === e.target.value);
              if (picked) setOffer(offerToText(picked));
            }}
            aria-label="Use a saved offer"
          >
            <option value="">Use a saved offer…</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <textarea
          className="script-step__body"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          placeholder="e.g. AI receptionist that answers every call 24/7 and books jobs — $299/mo, 14-day free trial"
          rows={2}
        />
      </div>

      <div className="new-session__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void submit()}
          disabled={saving || (!selectedLead && !manualName.trim())}
        >
          {saving ? "Starting…" : "Start session"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SessionDetailProps {
  sessionId: string;
  scripts: Script[];
  onBack: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}

function SessionDetail({
  sessionId,
  scripts,
  onBack,
  onDeleted,
  onError,
}: SessionDetailProps) {
  const [session, setSession] = useState<CallSessionDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [offer, setOffer] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [live, setLive] = useState(false);

  const loadSession = useCallback(() => {
    getSession(sessionId)
      .then((s) => {
        setSession(s);
        setNotes(s.notes);
        setOffer(s.offer);
      })
      .catch(() => onError("Couldn't load the session."));
  }, [sessionId, onError]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const script = useMemo(
    () => scripts.find((s) => s.id === session?.script_id) ?? null,
    [scripts, session],
  );

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

  const saveOffer = async () => {
    if (!session || offer === session.offer) return;
    try {
      const updated = await updateSession(session.id, { offer });
      setSession(updated);
    } catch {
      onError("Couldn't save the offer.");
    }
  };

  const remove = async () => {
    if (!session) return;
    if (!window.confirm("Delete this session? This can't be undone.")) return;
    try {
      await deleteSession(session.id);
      onDeleted();
    } catch {
      onError("Couldn't delete the session.");
    }
  };

  if (!session) {
    return (
      <div className="search-page">
        <div className="panel">
          <div className="search-loading">
            <span className="spinner" aria-hidden="true" />
            <p>Loading session…</p>
          </div>
        </div>
      </div>
    );
  }

  if (live) {
    return (
      <div className="search-page">
        <section className="panel">
          <LiveCallView
            session={session}
            script={script}
            onEnd={() => {
              setLive(false);
              loadSession();
            }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="search-page">
      <section className="panel">
        <div className="panel__header">
          <div>
            <button type="button" className="campaign-back" onClick={onBack}>
              ← All sessions
            </button>
            <h2 className="panel__title">{session.lead_name || "Untitled call"}</h2>
            <p className="results-sub">
              {new Date(session.started_at).toLocaleString()}
            </p>
          </div>
          <div className="results-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setLive(true)}
            >
              <MicIcon aria-hidden="true" />
              Live call
            </button>
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
                  No transcript yet. When live AI coaching is enabled, the call
                  transcript and suggested lines will appear here.
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
              placeholder="Post-call notes — who you spoke to, objections, next steps…"
              rows={5}
            />
            {savingNotes && <span className="muted">Saving…</span>}
          </div>

          <aside className="session-col session-col--aside">
            <h3 className="session-col__title">Offer</h3>
            <textarea
              className="script-step__body"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              onBlur={() => void saveOffer()}
              placeholder="What you're selling on this call…"
              rows={3}
            />

            <h3 className="session-col__title">Script</h3>
            {script ? (
              <div className="script-reference">
                <div className="script-reference__name">{script.name}</div>
                {script.steps.map((step, i) => (
                  <div key={i} className="script-reference__step">
                    <div className="script-reference__step-title">
                      {step.title || `Step ${i + 1}`}
                    </div>
                    <div className="script-reference__step-body">{step.body}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No script attached to this session.</p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
