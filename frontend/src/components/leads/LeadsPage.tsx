import { useEffect, useMemo, useState } from "react";

import { DownloadIcon, SearchIcon, TargetIcon, UsersIcon } from "@/components/icons";
import {
  addLeadsToCampaign,
  createCampaign,
  exportXlsx,
  listCampaigns,
  listLibraryLeads,
  setLeadStatus,
  type Campaign,
  type LibraryLead,
  type OutreachStatus,
} from "@/lib/api/leads";
import { downloadBlob, leadsToCsv } from "@/lib/csv";

const STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "passed", label: "Passed" },
];

type StatusFilter = OutreachStatus | "all";
type WebsiteFilter = "any" | "yes" | "no";

interface LeadsPageProps {
  onNewSearch: () => void;
}

export function LeadsPage({ onNewSearch }: LeadsPageProps) {
  const [leads, setLeads] = useState<LibraryLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [website, setWebsite] = useState<WebsiteFilter>("any");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listLibraryLeads()
      .then((rows) => {
        if (!cancelled) setLeads(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your leads.");
      });
    listCampaigns()
      .then((rows) => {
        if (!cancelled) setCampaigns(rows);
      })
      .catch(() => {
        // Non-critical — the add-to-campaign picker just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!leads) return [];
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.outreach_status !== statusFilter) return false;
      if (website === "yes" && !l.has_website) return false;
      if (website === "no" && l.has_website) return false;
      if (
        q &&
        !l.name.toLowerCase().includes(q) &&
        !l.location.toLowerCase().includes(q) &&
        !l.service.toLowerCase().includes(q) &&
        !l.address.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [leads, query, statusFilter, website]);

  const changeStatus = (placeId: string, status: OutreachStatus) => {
    const previous = leads?.find((l) => l.place_id === placeId)?.outreach_status;
    // Optimistic update; revert on failure.
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.place_id === placeId ? { ...l, outreach_status: status } : l,
          )
        : prev,
    );
    setLeadStatus(placeId, status).catch(() => {
      if (previous) {
        setLeads((prev) =>
          prev
            ? prev.map((l) =>
                l.place_id === placeId ? { ...l, outreach_status: previous } : l,
              )
            : prev,
        );
      }
      setError("Couldn't update lead status. Try again.");
    });
  };

  const doCsv = () => {
    if (!filtered.length) return;
    downloadBlob(
      new Blob([leadsToCsv(filtered)], { type: "text/csv;charset=utf-8" }),
      "leadflow_leads.csv",
    );
  };

  const doXlsx = async () => {
    if (!filtered.length) return;
    setExporting(true);
    try {
      const blob = await exportXlsx("Lead library", "All markets", filtered);
      downloadBlob(blob, "leadflow_leads.xlsx");
    } catch {
      setError("Excel export failed.");
    } finally {
      setExporting(false);
    }
  };

  const toggleSelected = (placeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.place_id));

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((l) => next.delete(l.place_id));
        return next;
      }
      return new Set([...prev, ...filtered.map((l) => l.place_id)]);
    });
  };

  const addToCampaign = async (campaignId: string) => {
    if (!selected.size || adding) return;
    setAdding(true);
    setError(null);
    try {
      let targetId = campaignId;
      let targetName = campaigns.find((c) => c.id === campaignId)?.name ?? "";
      if (campaignId === "__new__") {
        const name = window.prompt("Name for the new campaign:");
        if (!name?.trim()) {
          setAdding(false);
          return;
        }
        const created = await createCampaign(name.trim());
        setCampaigns((prev) => [created, ...prev]);
        targetId = created.id;
        targetName = created.name;
      }
      await addLeadsToCampaign(targetId, [...selected]);
      setNotice(
        `Added ${selected.size} lead${selected.size === 1 ? "" : "s"} to "${targetName}".`,
      );
      setSelected(new Set());
    } catch {
      setError("Couldn't add leads to the campaign.");
    } finally {
      setAdding(false);
    }
  };

  const filtersActive = query.trim() !== "" || statusFilter !== "all" || website !== "any";
  const loading = leads === null && !error;

  return (
    <div className="search-page">
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="alert alert--success" role="status">
          {notice}
          <button
            type="button"
            className="alert__dismiss"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="panel">
          <div className="search-loading">
            <span className="spinner" aria-hidden="true" />
            <p>Loading your lead library…</p>
          </div>
        </div>
      )}

      {leads && leads.length === 0 && (
        <section className="panel">
          <div className="empty-state">
            <span className="empty-state__icon">
              <UsersIcon aria-hidden="true" />
            </span>
            <h3 className="empty-state__title">No leads yet</h3>
            <p className="empty-state__text">
              Every business you find gets saved here automatically — one
              deduplicated library across all your searches.
            </p>
            <button
              type="button"
              className="btn btn--primary empty-state__cta"
              onClick={onNewSearch}
            >
              <SearchIcon aria-hidden="true" />
              Run a search
            </button>
          </div>
        </section>
      )}

      {leads && leads.length > 0 && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">All leads</h2>
              <p className="results-sub">
                Showing {filtered.length} of {leads.length} unique businesses
              </p>
            </div>
            <div className="results-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={doCsv}
                disabled={!filtered.length}
              >
                <DownloadIcon aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void doXlsx()}
                disabled={!filtered.length || exporting}
              >
                <DownloadIcon aria-hidden="true" />
                {exporting ? "Exporting…" : "Excel"}
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-bar__group filter-bar__group--grow">
              <input
                className="filter-input filter-input--search"
                type="search"
                placeholder="Search name, city, service…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search leads"
              />
            </div>

            <div className="filter-bar__group">
              <label className="filter-bar__label" htmlFor="lf-status">
                Status
              </label>
              <select
                id="lf-status"
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-bar__group">
              <label className="filter-bar__label" htmlFor="lf-website">
                Website
              </label>
              <select
                id="lf-website"
                className="filter-select"
                value={website}
                onChange={(e) => setWebsite(e.target.value as WebsiteFilter)}
              >
                <option value="any">Any</option>
                <option value="no">No website</option>
                <option value="yes">Has website</option>
              </select>
            </div>

            {filtersActive && (
              <button
                type="button"
                className="filter-bar__reset"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setWebsite("any");
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {selected.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-bar__count">
                <TargetIcon aria-hidden="true" />
                {selected.size} selected
              </span>
              <select
                className="filter-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) void addToCampaign(e.target.value);
                  e.target.value = "";
                }}
                disabled={adding}
                aria-label="Add selected leads to a campaign"
              >
                <option value="" disabled>
                  {adding ? "Adding…" : "Add to campaign…"}
                </option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">+ New campaign</option>
              </select>
              <button
                type="button"
                className="filter-bar__reset"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">No leads match your filters</h3>
              <p className="empty-state__text">
                Loosen the filters above to see more of your library.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th className="lead-table__check">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Select all filtered leads"
                      />
                    </th>
                    <th>Business</th>
                    <th>Found via</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th className="num">Rating</th>
                    <th className="num">Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.place_id}>
                      <td className="lead-table__check">
                        <input
                          type="checkbox"
                          checked={selected.has(l.place_id)}
                          onChange={() => toggleSelected(l.place_id)}
                          aria-label={`Select ${l.name}`}
                        />
                      </td>
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
                        <div>{l.service}</div>
                        <div className="lead-address">{l.location}</div>
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
                        {l.rating ?? "—"}
                        <span className="muted"> ({l.reviews})</span>
                      </td>
                      <td className="num">
                        <span className="score">{l.score.toFixed(2)}</span>
                      </td>
                      <td>
                        <select
                          className={`status-select status-select--${l.outreach_status}`}
                          value={l.outreach_status}
                          onChange={(e) =>
                            changeStatus(l.place_id, e.target.value as OutreachStatus)
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
