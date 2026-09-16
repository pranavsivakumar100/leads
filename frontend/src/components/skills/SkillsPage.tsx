import { useEffect, useRef, useState } from "react";

import { FileTextIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  setKnowledgeCoachEnabled,
  uploadKnowledgeDoc,
  type KnowledgeDoc,
} from "@/lib/api/skills";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SkillsPage() {
  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listKnowledgeDocs()
      .then(setDocs)
      .catch(() => setError("Couldn't load your knowledge bank."));

  useEffect(() => {
    void refresh();
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const doc = await uploadKnowledgeDoc(file);
        setDocs((prev) => (prev ? [doc, ...prev.filter((d) => d.id !== doc.id)] : [doc]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const toggle = (doc: KnowledgeDoc, enabled: boolean) => {
    setDocs((prev) =>
      prev
        ? prev.map((d) => (d.id === doc.id ? { ...d, coach_enabled: enabled } : d))
        : prev,
    );
    setKnowledgeCoachEnabled(doc.id, enabled).catch(() => {
      setDocs((prev) =>
        prev
          ? prev.map((d) =>
              d.id === doc.id ? { ...d, coach_enabled: doc.coach_enabled } : d,
            )
          : prev,
      );
      setError("Couldn't update the coach toggle.");
    });
  };

  const remove = async (doc: KnowledgeDoc) => {
    if (!window.confirm(`Delete “${doc.name}”?`)) return;
    setDocs((prev) => (prev ? prev.filter((d) => d.id !== doc.id) : prev));
    try {
      await deleteKnowledgeDoc(doc.id);
    } catch {
      setDocs((prev) => (prev ? [doc, ...prev] : [doc]));
      setError("Couldn't delete that document.");
    }
  };

  const loading = docs === null && !error;
  const enabledCount = docs?.filter((d) => d.coach_enabled).length ?? 0;

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
            <p>Loading knowledge bank…</p>
          </div>
        </div>
      )}

      {docs && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Knowledge bank</h2>
              <p className="results-sub">
                Upload scripts, frameworks, and offer notes. Toggle Use with
                coach on the ones the live coach should read
                {enabledCount ? ` (${enabledCount} on)` : ""}.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <PlusIcon aria-hidden="true" />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.txt,.md,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              multiple
              onChange={(e) => void onFiles(e.target.files)}
            />
          </div>

          {docs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <FileTextIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No documents yet</h3>
              <p className="empty-state__text">
                PDF, Word, or text. The coach only sees files you turn on.
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={() => inputRef.current?.click()}
              >
                <PlusIcon aria-hidden="true" />
                Upload a doc
              </button>
            </div>
          ) : (
            <ul className="knowledge-list">
              {docs.map((doc) => (
                <li key={doc.id} className="knowledge-row">
                  <span className="knowledge-row__icon" aria-hidden="true">
                    <FileTextIcon />
                  </span>
                  <div className="knowledge-row__meta">
                    <div className="knowledge-row__name">{doc.name}</div>
                    <div className="knowledge-row__sub">
                      {doc.filename}
                      {doc.size_bytes ? ` · ${formatSize(doc.size_bytes)}` : ""}
                      {doc.created_at ? ` · ${formatWhen(doc.created_at)}` : ""}
                    </div>
                  </div>
                  <label className="knowledge-toggle">
                    <span>Use with coach</span>
                    <span className="called-toggle">
                      <input
                        type="checkbox"
                        checked={doc.coach_enabled}
                        onChange={(e) => toggle(doc, e.target.checked)}
                        aria-label={`Use ${doc.name} with the coach`}
                      />
                      <span className="called-toggle__track" aria-hidden="true" />
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn btn--ghost knowledge-row__delete"
                    onClick={() => void remove(doc)}
                    aria-label={`Delete ${doc.name}`}
                  >
                    <TrashIcon aria-hidden="true" />
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
