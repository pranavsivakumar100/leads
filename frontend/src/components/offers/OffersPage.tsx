import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { CloseIcon, PlusIcon, TargetIcon } from "@/components/icons";
import {
  createOffer,
  deleteOffer,
  listOffers,
  updateOffer,
  type Offer,
  type OfferFitType,
} from "@/lib/api/coach";
import { FIT_TYPE_META } from "@/lib/offerFit";

const FIT_TYPES: OfferFitType[] = [
  "any",
  "no_website",
  "few_reviews",
  "low_rating",
  "high_volume",
];

type Draft = {
  name: string;
  description: string;
  pricing: string;
  fit_type: OfferFitType;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  pricing: "",
  fit_type: "any",
};

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listOffers()
      .then(setOffers)
      .catch(() => setError("Couldn't load your offers."));
  }, []);

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
  };

  const startEdit = (offer: Offer) => {
    setDraft({
      name: offer.name,
      description: offer.description,
      pricing: offer.pricing,
      fit_type: offer.fit_type,
    });
    setEditingId(offer.id);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId === "new") {
        const created = await createOffer(draft);
        setOffers((prev) => (prev ? [created, ...prev] : [created]));
      } else if (editingId) {
        const updated = await updateOffer(editingId, draft);
        setOffers((prev) =>
          prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
        );
      }
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    } catch {
      setError("Couldn't save the offer.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this offer?")) return;
    try {
      await deleteOffer(id);
      setOffers((prev) => (prev ? prev.filter((o) => o.id !== id) : prev));
    } catch {
      setError("Couldn't delete the offer.");
    }
  };

  const loading = offers === null && !error;

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
            <p>Loading offers…</p>
          </div>
        </div>
      )}

      {offers && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Offers</h2>
              <p className="results-sub">
                What you sell. Used to qualify leads by fit and to brief the
                call coach.
              </p>
            </div>
            {editingId === null && (
              <button type="button" className="btn btn--primary" onClick={startNew}>
                <PlusIcon aria-hidden="true" />
                New offer
              </button>
            )}
          </div>

          {editingId !== null && (
            <form className="offer-form" onSubmit={submit}>
              <div className="new-session__row">
                <label className="field-label">Name</label>
                <input
                  className="text-input"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. AI Receptionist"
                  autoFocus
                  maxLength={120}
                />
              </div>
              <div className="new-session__row">
                <label className="field-label">Pitch / value prop</label>
                <textarea
                  className="script-step__body"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder="Answers every call 24/7, books jobs straight to the calendar, never miss a lead again."
                  rows={3}
                />
              </div>
              <div className="offer-form__grid">
                <div className="new-session__row">
                  <label className="field-label">Pricing</label>
                  <input
                    className="text-input"
                    value={draft.pricing}
                    onChange={(e) =>
                      setDraft({ ...draft, pricing: e.target.value })
                    }
                    placeholder="$299/mo · 14-day trial"
                    maxLength={200}
                  />
                </div>
                <div className="new-session__row">
                  <label className="field-label">Best-fit leads</label>
                  <select
                    className="filter-select"
                    value={draft.fit_type}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fit_type: e.target.value as OfferFitType,
                      })
                    }
                  >
                    {FIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FIT_TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="offer-form__hint">{FIT_TYPE_META[draft.fit_type].hint}</p>
              <div className="new-session__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!draft.name.trim() || saving}
                >
                  {saving ? "Saving…" : "Save offer"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(EMPTY_DRAFT);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {offers.length === 0 && editingId === null ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <TargetIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No offers yet</h3>
              <p className="empty-state__text">
                Add what you sell — the coach uses it on calls, and Leads can be
                ranked by how well they fit each offer.
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={startNew}
              >
                <PlusIcon aria-hidden="true" />
                New offer
              </button>
            </div>
          ) : offers.length > 0 ? (
            <ul className="campaign-list">
              {offers.map((o) => (
                <li key={o.id} className="campaign-card">
                  <button
                    type="button"
                    className="campaign-card__main"
                    onClick={() => startEdit(o)}
                  >
                    <div className="campaign-card__head">
                      <span className="campaign-card__name">{o.name}</span>
                      {o.pricing && (
                        <span className="campaign-card__date">{o.pricing}</span>
                      )}
                    </div>
                    {o.description && (
                      <div className="campaign-card__meta">{o.description}</div>
                    )}
                    <div className="offer-card__fit">
                      Targets: {FIT_TYPE_META[o.fit_type].label}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="icon-btn campaign-card__delete"
                    onClick={() => void remove(o.id)}
                    aria-label={`Delete ${o.name}`}
                    title="Delete offer"
                  >
                    <CloseIcon aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  );
}
