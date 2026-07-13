import { useEffect, useState } from "react";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  FileTextIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  createScript,
  deleteScript,
  listScripts,
  updateScript,
  type Script,
  type ScriptStep,
} from "@/lib/api/coach";

// A sensible cold-call framework to seed new scripts with.
const STARTER_STEPS: ScriptStep[] = [
  { title: "Opener", body: "Hi, is this {owner}? This is {you} with {company}…" },
  {
    title: "Reason for call",
    body: "The reason I'm calling — I work with local {industry} businesses to…",
  },
  {
    title: "Qualifying questions",
    body: "How are you currently handling {pain point}?",
  },
  { title: "Value prop", body: "What we do is…" },
  {
    title: "Objection handling",
    body: "\"Not interested\" → …\n\"Too busy\" → …\n\"Send me an email\" → …",
  },
  { title: "Close", body: "Would it make sense to grab 15 minutes this week?" },
];

interface ScriptsPageProps {
  onStartCall?: (scriptId: string) => void;
}

export function ScriptsPage(_props: ScriptsPageProps) {
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Script | null>(null);

  useEffect(() => {
    listScripts()
      .then(setScripts)
      .catch(() => setError("Couldn't load your scripts."));
  }, []);

  const startNew = async () => {
    setError(null);
    try {
      const created = await createScript(
        "Untitled script",
        "",
        STARTER_STEPS,
      );
      setScripts((prev) => (prev ? [created, ...prev] : [created]));
      setEditing(created);
    } catch {
      setError("Couldn't create the script.");
    }
  };

  const saveEditing = async (script: Script) => {
    try {
      const saved = await updateScript(script.id, {
        name: script.name.trim() || "Untitled script",
        description: script.description,
        steps: script.steps,
      });
      setScripts((prev) =>
        prev ? prev.map((s) => (s.id === saved.id ? saved : s)) : prev,
      );
      setEditing(null);
    } catch {
      setError("Couldn't save the script.");
    }
  };

  const removeScript = async (id: string) => {
    if (!window.confirm("Delete this script?")) return;
    try {
      await deleteScript(id);
      setScripts((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      if (editing?.id === id) setEditing(null);
    } catch {
      setError("Couldn't delete the script.");
    }
  };

  if (editing) {
    return (
      <ScriptEditor
        script={editing}
        onChange={setEditing}
        onSave={() => void saveEditing(editing)}
        onCancel={() => setEditing(null)}
        onDelete={() => void removeScript(editing.id)}
      />
    );
  }

  const loading = scripts === null && !error;

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
            <p>Loading scripts…</p>
          </div>
        </div>
      )}

      {scripts && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Call scripts</h2>
              <p className="results-sub">
                Frameworks you work from on a call. The coach will use these to
                suggest what to say.
              </p>
            </div>
            <button type="button" className="btn btn--primary" onClick={() => void startNew()}>
              <PlusIcon aria-hidden="true" />
              New script
            </button>
          </div>

          {scripts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <FileTextIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No scripts yet</h3>
              <p className="empty-state__text">
                Save the frameworks you use on cold calls — opener, value prop,
                objection handling, close.
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={() => void startNew()}
              >
                <PlusIcon aria-hidden="true" />
                New script
              </button>
            </div>
          ) : (
            <ul className="campaign-list">
              {scripts.map((s) => (
                <li key={s.id} className="campaign-card">
                  <button
                    type="button"
                    className="campaign-card__main"
                    onClick={() => setEditing(s)}
                  >
                    <div className="campaign-card__head">
                      <span className="campaign-card__name">{s.name}</span>
                      <span className="campaign-card__date">
                        {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {s.description && (
                      <div className="campaign-card__meta">{s.description}</div>
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-btn campaign-card__delete"
                    onClick={() => void removeScript(s.id)}
                    aria-label={`Delete ${s.name}`}
                    title="Delete script"
                  >
                    <CloseIcon aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

interface ScriptEditorProps {
  script: Script;
  onChange: (script: Script) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ScriptEditor({
  script,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: ScriptEditorProps) {
  const setStep = (i: number, patch: Partial<ScriptStep>) => {
    onChange({
      ...script,
      steps: script.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  };

  const addStep = () =>
    onChange({ ...script, steps: [...script.steps, { title: "", body: "" }] });

  const removeStep = (i: number) =>
    onChange({ ...script, steps: script.steps.filter((_, idx) => idx !== i) });

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= script.steps.length) return;
    const steps = [...script.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    onChange({ ...script, steps });
  };

  return (
    <div className="search-page">
      <section className="panel">
        <div className="panel__header">
          <div>
            <button type="button" className="campaign-back" onClick={onCancel}>
              ← All scripts
            </button>
            <input
              className="script-title-input"
              value={script.name}
              onChange={(e) => onChange({ ...script, name: e.target.value })}
              placeholder="Script name"
              aria-label="Script name"
            />
          </div>
          <div className="results-actions">
            <button type="button" className="btn btn--ghost" onClick={onDelete}>
              <TrashIcon aria-hidden="true" />
              Delete
            </button>
            <button type="button" className="btn btn--primary" onClick={onSave}>
              Save
            </button>
          </div>
        </div>

        <label className="field-label" htmlFor="script-desc">
          Description
        </label>
        <input
          id="script-desc"
          className="text-input"
          value={script.description}
          onChange={(e) => onChange({ ...script, description: e.target.value })}
          placeholder="When to use this script, e.g. HVAC businesses with no website"
        />

        <div className="script-steps">
          {script.steps.map((step, i) => (
            <div key={i} className="script-step">
              <div className="script-step__head">
                <input
                  className="script-step__title"
                  value={step.title}
                  onChange={(e) => setStep(i, { title: e.target.value })}
                  placeholder={`Step ${i + 1} title`}
                  aria-label={`Step ${i + 1} title`}
                />
                <div className="script-step__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    aria-label="Move step up"
                    title="Move up"
                  >
                    <ChevronUpIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === script.steps.length - 1}
                    aria-label="Move step down"
                    title="Move down"
                  >
                    <ChevronDownIcon aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeStep(i)}
                    aria-label="Remove step"
                    title="Remove step"
                  >
                    <CloseIcon aria-hidden="true" />
                  </button>
                </div>
              </div>
              <textarea
                className="script-step__body"
                value={step.body}
                onChange={(e) => setStep(i, { body: e.target.value })}
                placeholder="What to say…"
                rows={3}
              />
            </div>
          ))}
        </div>

        <button type="button" className="btn btn--secondary" onClick={addStep}>
          <PlusIcon aria-hidden="true" />
          Add step
        </button>
      </section>
    </div>
  );
}
