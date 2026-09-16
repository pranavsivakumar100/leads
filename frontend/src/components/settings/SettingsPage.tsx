import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  PhoneIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { ModelSelect } from "@/components/settings/ModelSelect";
import {
  getSettings,
  listCoachModels,
  updateSettings,
  type AppSettings,
  type CoachModelOption,
  type IntegrationStatus,
  type SettingsPatch,
} from "@/lib/api/settings";

function StatusPill({
  on,
  source,
}: {
  on: boolean;
  source?: IntegrationStatus["source"];
}) {
  const label =
    source === "env" ? "Local .env" : on ? "Connected" : "Not set";
  return (
    <span
      className={`settings-pill${on || source === "env" ? " settings-pill--on" : ""}`}
    >
      {label}
    </span>
  );
}

function SecretField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        className="text-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder || (hint ? `Saved ${hint}` : "Paste key")}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SettingsPage({ displayName }: { displayName: string }) {
  const [data, setData] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [mapsKey, setMapsKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [coachModel, setCoachModel] = useState("");
  const [coachBase, setCoachBase] = useState("");
  const [coachModels, setCoachModels] = useState<CoachModelOption[]>([]);
  const [coachModelsSource, setCoachModelsSource] = useState<"api" | "fallback">(
    "fallback",
  );
  const [coachModelsHint, setCoachModelsHint] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioKey, setTwilioKey] = useState("");
  const [twilioSecret, setTwilioSecret] = useState("");
  const [twimlSid, setTwimlSid] = useState("");
  const [callerId, setCallerId] = useState("");

  const loadCoachModels = () => {
    setModelsLoading(true);
    return listCoachModels()
      .then((res) => {
        setCoachModels(res.models);
        setCoachModelsSource(res.source);
        setCoachModelsHint(res.error || null);
      })
      .catch((err) => {
        setCoachModelsHint(
          err instanceof Error ? err.message : "Couldn't load model list.",
        );
      })
      .finally(() => setModelsLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setCoachModel(res.coach.model);
        setCoachBase(res.coach.base_url);
        setCallerId(res.voice.caller_id);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load settings.");
        }
      });
    void loadCoachModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelGroups = useMemo(() => {
    const current = coachModel.trim();
    const rows = [...coachModels];
    if (current && !rows.some((m) => m.id === current)) {
      rows.unshift({ id: current, provider: "Saved" });
    }
    const groups = new Map<string, CoachModelOption[]>();
    for (const model of rows) {
      const list = groups.get(model.provider) ?? [];
      list.push(model);
      groups.set(model.provider, list);
    }
    return [...groups.entries()];
  }, [coachModel, coachModels]);


  const kpis = useMemo(() => {
    const usage = data?.usage;
    const raw = usage?.twilio_balance;
    const n = raw != null ? Number(raw) : NaN;
    const balance = Number.isFinite(n)
      ? `${usage?.twilio_currency || "USD"} ${n.toFixed(2)}`
      : raw || "—";
    return [
      {
        label: "Leads",
        value: usage ? usage.total_leads.toLocaleString() : "—",
        meta: "In your library",
        Icon: UsersIcon,
      },
      {
        label: "Searches",
        value: usage ? usage.searches_run.toLocaleString() : "—",
        meta: "Lifetime",
        Icon: SearchIcon,
      },
      {
        label: "Sessions",
        value: usage ? usage.sessions.toLocaleString() : "—",
        meta: "Calls logged",
        Icon: PhoneIcon,
      },
      {
        label: "Twilio balance",
        value: balance,
        meta: data?.voice.configured ? "Voice + SMS" : "Add Twilio keys",
        Icon: SettingsIcon,
      },
    ];
  }, [data]);

  const save = async (section: string, patch: SettingsPatch) => {
    const body = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => (v ?? "").trim() !== ""),
    ) as SettingsPatch;
    if (Object.keys(body).length === 0) {
      setNotice("Enter a new value to save.");
      return;
    }
    setSaving(section);
    setError(null);
    setNotice(null);
    try {
      const next = await updateSettings(body);
      setData(next);
      setCoachModel(next.coach.model);
      setCoachBase(next.coach.base_url);
      setCallerId(next.voice.caller_id);
      if (section === "search") setMapsKey("");
      if (section === "coach") {
        setOpenaiKey("");
        void loadCoachModels();
      }
      if (section === "voice") {
        setTwilioSid("");
        setTwilioToken("");
        setTwilioKey("");
        setTwilioSecret("");
        setTwimlSid("");
      }
      setNotice("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(null);
    }
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    void save("search", { google_maps_api_key: mapsKey });
  };

  const onCoach = (e: FormEvent) => {
    e.preventDefault();
    void save("coach", {
      openai_api_key: openaiKey,
      coach_model: coachModel,
      coach_base_url: coachBase,
    });
  };

  const onVoice = (e: FormEvent) => {
    e.preventDefault();
    void save("voice", {
      twilio_account_sid: twilioSid,
      twilio_auth_token: twilioToken,
      twilio_api_key: twilioKey,
      twilio_api_secret: twilioSecret,
      twilio_twiml_app_sid: twimlSid,
      twilio_caller_id: callerId,
    });
  };

  return (
    <div className="settings-page">
      <header className="settings-page__intro">
        <h1 className="settings-page__title">Settings</h1>
        <p className="settings-page__lede">
          Each account uses its own Google, OpenAI, and Twilio keys — billed to
          that account. Paste yours below. Leave a field blank to keep a saved
          value.
        </p>
      </header>

      {data?.env_fallback && (
        <div className="alert" role="status">
          This machine is in local mode: until you save keys here, Search, Coach,
          and Dial use the server <code>.env</code>. Production accounts never
          share those credentials.
        </div>
      )}

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert--success" role="status">
          {notice}
        </div>
      )}

      <section className="kpi-grid" aria-label="Usage">
        {kpis.map(({ label, value, meta, Icon }) => (
          <article key={label} className="kpi-card">
            <div className="kpi-card__top">
              <span className="kpi-card__label">{label}</span>
              <span className="kpi-card__icon">
                <Icon aria-hidden="true" />
              </span>
            </div>
            <div className="kpi-card__value kpi-card__value--sm">{value}</div>
            <div className="kpi-card__meta">{meta}</div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Account</h2>
        </div>
        <div className="settings-body">
          <div className="settings-kv">
            <span className="field-label">Name</span>
            <span>{displayName}</span>
          </div>
          <div className="settings-kv">
            <span className="field-label">Email</span>
            <span>{data?.email || "—"}</span>
          </div>
        </div>
      </section>

      <form className="panel" onSubmit={onSearch}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Google Maps</h2>
            <p className="results-sub">Places API (New) — used for Search.</p>
          </div>
          <StatusPill on={!!data?.search.configured} source={data?.search.source} />
        </div>
        <div className="settings-body">
          <SecretField
            id="maps-key"
            label="API key"
            hint={data?.search.hint}
            value={mapsKey}
            onChange={setMapsKey}
          />
          <div className="settings-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving === "search"}
            >
              {saving === "search" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>

      <form className="panel" onSubmit={onCoach}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">AI coach</h2>
            <p className="results-sub">
              OpenAI-compatible chat API for live call suggestions.
            </p>
          </div>
          <StatusPill on={!!data?.coach.configured} source={data?.coach.source} />
        </div>
        <div className="settings-body">
          <SecretField
            id="openai-key"
            label="API key"
            hint={data?.coach.hint}
            value={openaiKey}
            onChange={setOpenaiKey}
          />
          <div className="settings-grid">
            <div className="settings-field">
              <label className="field-label" htmlFor="coach-model">
                Model
              </label>
              <ModelSelect
                id="coach-model"
                value={coachModel}
                groups={modelGroups}
                disabled={modelsLoading && modelGroups.length === 0}
                onChange={setCoachModel}
              />
              <span className="settings-help">
                {coachModelsSource === "api"
                  ? "Chat models your API key can use right now."
                  : "Common OpenAI chat models. Save a key to load the live list."}
                {coachModelsHint ? ` ${coachModelsHint}` : ""}
              </span>
            </div>
            <label className="settings-field" htmlFor="coach-base">
              <span className="field-label">Base URL</span>
              <input
                id="coach-base"
                className="text-input"
                value={coachBase}
                onChange={(e) => setCoachBase(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving === "coach"}
            >
              {saving === "coach" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>

      <form className="panel" onSubmit={onVoice}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Twilio Voice</h2>
            <p className="results-sub">Browser dialer. Caller ID must be a number you own.</p>
          </div>
          <StatusPill on={!!data?.voice.configured} source={data?.voice.source} />
        </div>
        <div className="settings-body">
          <div className="settings-grid">
            <SecretField
              id="twilio-sid"
              label="Account SID"
              hint={data?.voice.account_hint}
              value={twilioSid}
              onChange={setTwilioSid}
            />
            <SecretField
              id="twilio-token"
              label="Auth token"
              value={twilioToken}
              onChange={setTwilioToken}
            />
            <SecretField
              id="twilio-key"
              label="API key SID"
              value={twilioKey}
              onChange={setTwilioKey}
            />
            <SecretField
              id="twilio-secret"
              label="API key secret"
              hint={data?.voice.hint}
              value={twilioSecret}
              onChange={setTwilioSecret}
            />
            <SecretField
              id="twiml-sid"
              label="TwiML App SID"
              hint={data?.voice.twiml_hint}
              value={twimlSid}
              onChange={setTwimlSid}
            />
            <label className="settings-field" htmlFor="caller-id">
              <span className="field-label">Caller ID</span>
              <input
                id="caller-id"
                className="text-input"
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
                placeholder="+1…"
              />
            </label>
          </div>
          {data?.voice.webhook_url && (
            <label className="settings-field">
              <span className="field-label">TwiML Voice URL</span>
              <span className="settings-copyrow">
                <input
                  className="text-input"
                  readOnly
                  value={data.voice.webhook_url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(data.voice.webhook_url)
                  }
                >
                  Copy
                </button>
              </span>
              <span className="settings-help">
                In your Twilio TwiML App, set the Voice request URL to this so
                outbound calls from Leadflow can connect.
              </span>
            </label>
          )}
          <div className="settings-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving === "voice"}
            >
              {saving === "voice" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
