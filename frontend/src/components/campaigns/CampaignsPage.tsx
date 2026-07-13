import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  CloseIcon,
  DownloadIcon,
  PlusIcon,
  TargetIcon,
} from "@/components/icons";
import {
  createCampaign,
  deleteCampaign,
  exportXlsx,
  getCampaignLeads,
  listCampaigns,
  removeLeadFromCampaign,
  setLeadStatus,
  type Campaign,
  type LibraryLead,
  type OutreachStatus,
} from "@/lib/api/leads";
import { downloadBlob, leadsToCsv, slug } from "@/lib/csv";

const STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "passed", label: "Passed" },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface CampaignsPageProps {
  onGoToLeads: () => void;
}

export function CampaignsPage({ onGoToLeads }: CampaignsPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LibraryLead[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const open = useMemo(
    () => campaigns?.find((c) => c.id === openId) ?? null,
    [campaigns, openId],
  );

  const refresh = () =>
    listCampaigns()
      .then(setCampaigns)
      .catch(() => setError("Couldn't load campaigns."));

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!openId) {
      setLeads(null);
      return;
    }
    let cancelled = false;
    setLeads(null);
    getCampaignLeads(openId)
      .then((rows) => {
        if (!cancelled) setLeads(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load campaign leads.");
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCampaign(name);
      setCampaigns((prev) => (prev ? [created, ...prev] : [created]));
      setNewName("");
      setCreating(false);
    } catch {
      setError("Couldn't create the campaign.");
    } finally {
      setSaving(false);
    }
  };

  const removeCampaign = async (id: string) => {
    if (!window.confirm("Delete this campaign? Leads stay in your library.")) {
      return;
    }
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
      if (openId === id) setOpenId(null);
    } catch {
      setError("Couldn't delete the campaign.");
    }
  };

  const changeStatus = (placeId: string, status: OutreachStatus) => {
    const previous = leads?.find((l) => l.place_id === placeId)?.outreach_status;
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.place_id === placeId ? { ...l, outreach_status: status } : l,
          )
        : prev,
    );
    setLeadStatus(placeId, status)
      .then(() => void refresh())
      .catch(() => {
        if (previous) {
          setLeads((prev) =>
            prev
              ? prev.map((l) =>
                  l.place_id === placeId
                    ? { ...l, outreach_status: previous }
                    : l,
                )
              : prev,
          );
        }
        setError("Couldn't update lead status.");
      });
  };

  const removeLead = async (placeId: string) => {
    if (!openId) return;
    try {
      await removeLeadFromCampaign(openId, placeId);
      setLeads((prev) =>
        prev ? prev.filter((l) => l.place_id !== placeId) : prev,
      );
      void refresh();
    } catch {
      setError("Couldn't remove the lead.");
    }
  };

  const doCsv = () => {
    if (!open || !leads?.length) return;
    downloadBlob(
      new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" }),
      `${slug(open.name)}_campaign.csv`,
    );
  };

  const doXlsx = async () => {
    if (!open || !leads?.length) return;
    setExporting(true);
    try {
      const blob = await exportXlsx(open.name, "Campaign", leads);
      downloadBlob(blob, `${slug(open.name)}_campaign.xlsx`);
    } catch {
      setError("Excel export failed.");
    } finally {
      setExporting(false);
    }
  };

  const loading = campaigns === null && !error;

  // ---------- Detail view ----------
  if (open) {
    return (
      <div className="search-page">
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <section className="panel">
          <div className="panel__header">
            <div>
              <button
                type="button"
                className="campaign-back"
                onClick={() => setOpenId(null)}
              >
                ← All campaigns
              </button>
              <h2 className="panel__title">{open.name}</h2>
              <p className="results-sub">
                {open.lead_count} lead{open.lead_count === 1 ? "" : "s"} ·{" "}
                {open.status_counts.contacted + open.status_counts.interested + open.status_counts.passed}{" "}
                worked
              </p>
            </div>
            <div className="results-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={doCsv}
                disabled={!leads?.length}
              >
                <DownloadIcon aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void doXlsx()}
                disabled={!leads?.length || exporting}
              >
                <DownloadIcon aria-hidden="true" />
                {exporting ? "Exporting…" : "Excel"}
              </button>
            </div>
          </div>

          {leads === null ? (
            <div className="search-loading">
              <span className="spinner" aria-hidden="true" />
              <p>Loading campaign leads…</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">No leads in this campaign</h3>
              <p className="empty-state__text">
                Go to your Leads library, select businesses, and add them to
                this campaign.
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={onGoToLeads}
              >
                Open Leads
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th className="num">Score</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.place_id}>
                      <td>
                        <a
                          href={l.maps_uri}
                          target="_blank"
                          rel="noreferrer"
                          className="lead-name"
                        >
                          {l.name}
                        </a>
                        <div className="lead-address">{l.address}</div>
                      </td>
                      <td>
                        {l.phone ? (
                          <a href={`tel:${l.phone}`} className="lead-link">
                            {l.phone}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {l.website ? (
                          <a
                            href={l.website}
                            target="_blank"
                            rel="noreferrer"
                            className="lead-link"
                          >
                            Visit
                          </a>
                        ) : (
                          <span className="badge badge--warn">No site</span>
                        )}
                      </td>
                      <td className="num">
                        <span className="score">{l.score.toFixed(2)}</span>
                      </td>
                      <td>
                        <select
                          className={`status-select status-select--${l.outreach_status}`}
                          value={l.outreach_status}
                          onChange={(e) =>
                            changeStatus(
                              l.place_id,
                              e.target.value as OutreachStatus,
                            )
                          }
                          aria-label={`Status for ${l.name}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => void removeLead(l.place_id)}
                          aria-label={`Remove ${l.name} from campaign`}
                          title="Remove from campaign"
                        >
                          <CloseIcon aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------- List view ----------
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
            <p>Loading campaigns…</p>
          </div>
        </div>
      )}

      {campaigns && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Campaigns</h2>
              <p className="results-sub">
                Group leads into outreach lists and track progress.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setCreating(true)}
            >
              <PlusIcon aria-hidden="true" />
              New campaign
            </button>
          </div>

          {creating && (
            <form className="campaign-create" onSubmit={submitCreate}>
              <input
                className="text-input"
                placeholder="Campaign name, e.g. Newark HVAC — no website"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!newName.trim() || saving}
              >
                {saving ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {campaigns.length === 0 && !creating ? (
            <div className="empty-state">
              <span className="empty-state__icon">
                <TargetIcon aria-hidden="true" />
              </span>
              <h3 className="empty-state__title">No campaigns yet</h3>
              <p className="empty-state__text">
                Create a campaign, then add leads from your library — e.g.
                "Newark HVAC without websites".
              </p>
              <button
                type="button"
                className="btn btn--primary empty-state__cta"
                onClick={() => setCreating(true)}
              >
                <PlusIcon aria-hidden="true" />
                New campaign
              </button>
            </div>
          ) : campaigns.length > 0 ? (
            <ul className="campaign-list">
              {campaigns.map((c) => {
                const worked =
                  c.status_counts.contacted +
                  c.status_counts.interested +
                  c.status_counts.passed;
                const pct = c.lead_count
                  ? Math.round((worked / c.lead_count) * 100)
                  : 0;
                return (
                  <li key={c.id} className="campaign-card">
                    <button
                      type="button"
                      className="campaign-card__main"
                      onClick={() => setOpenId(c.id)}
                    >
                      <div className="campaign-card__head">
                        <span className="campaign-card__name">{c.name}</span>
                        <span className="campaign-card__date">
                          {formatWhen(c.created_at)}
                        </span>
                      </div>
                      <div className="campaign-card__meta">
                        {c.lead_count} lead{c.lead_count === 1 ? "" : "s"}
                        {c.lead_count > 0 && <> · {pct}% worked</>}
                        {c.status_counts.interested > 0 && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="campaign-card__interested">
                              {c.status_counts.interested} interested
                            </span>
                          </>
                        )}
                      </div>
                      <div
                        className="campaign-progress"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span
                          className="campaign-progress__fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                    <button
                      type="button"
                      className="icon-btn campaign-card__delete"
                      onClick={() => void removeCampaign(c.id)}
                      aria-label={`Delete campaign ${c.name}`}
                      title="Delete campaign"
                    >
                      <CloseIcon aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  );
}
