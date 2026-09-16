import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { LeadPhone } from "@/components/dialer/LeadPhone";
import { LeadNameCell } from "@/components/leads/LeadNameCell";
import {
  DownloadIcon,
  SearchIcon,
} from "@/components/icons";
import { InfoTip } from "@/components/search/InfoTip";
import { LocationAutocomplete } from "@/components/search/LocationAutocomplete";
import { ApiError } from "@/lib/api/client";
import {
  exportXlsx,
  getSavedLeads,
  listLibraryLeads,
  listServices,
  runSearch,
  setLeadFollowUp,
  setLeadStatus,
  type Lead,
  type OutreachStatus,
  type ServicePreset,
} from "@/lib/api/leads";
import { downloadBlob, leadsToCsv, slug } from "@/lib/csv";
import { onCrmLeadPatch } from "@/lib/crmEvents";

function isCalled(status: OutreachStatus | undefined): boolean {
  return !!status && status !== "new";
}

/** Merge library outreach flags onto scrape results by place_id. */
async function withOutreachStatuses(rows: Lead[]): Promise<Lead[]> {
  try {
    const library = await listLibraryLeads();
    const byPlace = new Map(
      library.map(
        (l) =>
          [
            l.place_id,
            {
              outreach_status: l.outreach_status,
              follow_up: l.follow_up,
            },
          ] as const,
      ),
    );
    return rows.map((l) => {
      const known = byPlace.get(l.place_id);
      return {
        ...l,
        outreach_status:
          known?.outreach_status ?? l.outreach_status ?? "new",
        follow_up: known?.follow_up ?? l.follow_up ?? false,
      };
    });
  } catch {
    return rows.map((l) => ({
      ...l,
      outreach_status: l.outreach_status ?? "new",
      follow_up: l.follow_up ?? false,
    }));
  }
}

export interface SavedSearchRef {
  id: string;
  service: string;
  location: string;
}

const COVERAGE_OPTIONS = [
  { value: 8, label: "City" },
  { value: 15, label: "Metro" },
  { value: 40, label: "Wide" },
] as const;

const RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 3, label: "3.0+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

type WebsiteFilter = "any" | "yes" | "no";

interface SearchPageProps {
  /** When set, load and show the leads from a previously saved search. */
  savedSearch?: SavedSearchRef | null;
}

export function SearchPage({ savedSearch = null }: SearchPageProps) {
  const [services, setServices] = useState<ServicePreset[]>([]);
  const [service, setService] = useState("HVAC");
  const [location, setLocation] = useState("");
  const [deep, setDeep] = useState(true);
  const [radiusKm, setRadiusKm] = useState(15);

  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"scrape" | "load">("scrape");
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [meta, setMeta] = useState<{ service: string; location: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Post-fetch filters (applied client-side; no re-scrape needed).
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState("");
  const [maxReviews, setMaxReviews] = useState("");
  const [website, setWebsite] = useState<WebsiteFilter>("any");

  useEffect(() => {
    listServices()
      .then(setServices)
      .catch(() => {
        // Non-critical; the input still accepts a custom service.
      });
  }, []);

  useEffect(() => {
    return onCrmLeadPatch((patch) => {
      setLeads((prev) =>
        prev
          ? prev.map((l) =>
              l.place_id === patch.placeId
                ? {
                    ...l,
                    follow_up: patch.followUp ?? l.follow_up,
                    outreach_status: patch.outreachStatus ?? l.outreach_status,
                  }
                : l,
            )
          : prev,
      );
    });
  }, []);

  // Load a previously saved search's leads when opened from the dashboard.
  useEffect(() => {
    if (!savedSearch) return;
    let cancelled = false;
    setService(savedSearch.service);
    setLocation(savedSearch.location);
    setLoadingMode("load");
    setLoading(true);
    setError(null);
    resetFilters();
    getSavedLeads(savedSearch.id)
      .then((rows) => withOutreachStatuses(rows))
      .then((rows) => {
        if (cancelled) return;
        setLeads(rows);
        setMeta({ service: savedSearch.service, location: savedSearch.location });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Couldn't load saved leads.",
        );
        setLeads(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSearch]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const lo = minReviews.trim() === "" ? 0 : Number(minReviews);
    const hi = maxReviews.trim() === "" ? Infinity : Number(maxReviews);
    return leads.filter((l) => {
      if ((l.rating ?? 0) < minRating) return false;
      if (l.reviews < lo || l.reviews > hi) return false;
      if (website === "yes" && !l.has_website) return false;
      if (website === "no" && l.has_website) return false;
      return true;
    });
  }, [leads, minRating, minReviews, maxReviews, website]);

  const noWebsiteCount = useMemo(
    () => filteredLeads.filter((l) => !l.has_website).length,
    [filteredLeads],
  );

  const filtersActive =
    minRating > 0 || minReviews.trim() !== "" || maxReviews.trim() !== "" || website !== "any";

  const resetFilters = () => {
    setMinRating(0);
    setMinReviews("");
    setMaxReviews("");
    setWebsite("any");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!location.trim() || loading) return;
    setLoadingMode("scrape");
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({
        service,
        location: location.trim(),
        deep,
        radius_km: deep ? radiusKm : 15,
      });
      setLeads(await withOutreachStatuses(res.leads));
      setMeta({ service: res.service, location: res.location });
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError("Scraping isn't configured on the server (missing Google Maps key).");
      } else {
        setError(err instanceof Error ? err.message : "Search failed. Try again.");
      }
      setLeads(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleCalled = (placeId: string, called: boolean) => {
    if (!placeId) return;
    const next: OutreachStatus = called ? "contacted" : "new";
    const previous =
      leads?.find((l) => l.place_id === placeId)?.outreach_status ?? "new";
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.place_id === placeId ? { ...l, outreach_status: next } : l,
          )
        : prev,
    );
    setLeadStatus(placeId, next).catch(() => {
      setLeads((prev) =>
        prev
          ? prev.map((l) =>
              l.place_id === placeId
                ? { ...l, outreach_status: previous }
                : l,
            )
          : prev,
      );
      setError("Couldn't update call status. Try again.");
    });
  };

  const toggleFollowUp = (placeId: string, followUp: boolean) => {
    if (!placeId) return;
    const previous =
      leads?.find((l) => l.place_id === placeId)?.follow_up ?? false;
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.place_id === placeId ? { ...l, follow_up: followUp } : l,
          )
        : prev,
    );
    setLeadFollowUp(placeId, followUp).catch(() => {
      setLeads((prev) =>
        prev
          ? prev.map((l) =>
              l.place_id === placeId ? { ...l, follow_up: previous } : l,
            )
          : prev,
      );
      setError("Couldn't update follow-up. Try again.");
    });
  };

  const doCsv = () => {
    if (!meta || !filteredLeads.length) return;
    const csv = leadsToCsv(filteredLeads);
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${slug(meta.location)}_${slug(meta.service)}_leads.csv`,
    );
  };

  const doXlsx = async () => {
    if (!meta || !filteredLeads.length) return;
    setExporting(true);
    try {
      const blob = await exportXlsx(meta.service, meta.location, filteredLeads);
      downloadBlob(
        blob,
        `${slug(meta.location)}_${slug(meta.service)}_leads.xlsx`,
      );
    } catch {
      setError("Excel export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="search-page">
      <form className="search-form" onSubmit={submit}>
        <div className="search-form__field search-form__field--service">
          <label className="field-label" htmlFor="service">
            Service
          </label>
          <input
            id="service"
            className="text-input"
            list="service-options"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. HVAC"
          />
          <datalist id="service-options">
            {services.map((s) => (
              <option key={s.label} value={s.label} />
            ))}
          </datalist>
        </div>

        <div className="search-form__field search-form__field--location">
          <label className="field-label" htmlFor="location">
            Location
          </label>
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
            disabled={loading}
            required
          />
        </div>

        <div
          className={`search-form__field search-form__field--coverage${deep ? "" : " search-form__field--disabled"}`}
        >
          <div className="field-label-row">
            <label className="field-label" htmlFor="coverage">
              Coverage
            </label>
            <InfoTip label="About coverage area" placement="top">
              How far deep search scans from your location. City is tight;
              Metro is the default; Wide includes outer suburbs. Only applies
              when deep search is on.
            </InfoTip>
          </div>
          <select
            id="coverage"
            className="text-input"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            disabled={loading || !deep}
          >
            {COVERAGE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="search-form__deep">
          <input
            id="deep-search"
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
          />
          <div className="search-form__deep-label">
            <label className="search-form__deep-text" htmlFor="deep-search">
              Deep search
            </label>
            <InfoTip label="About deep search">
              Google caps each query at ~60 results. Deep search tiles a grid
              around your location to pull 100–300+ unique leads from nearby
              areas. Slower and uses more API calls.
            </InfoTip>
          </div>
        </div>

        <button type="submit" className="btn btn--primary search-form__submit" disabled={loading}>
          <SearchIcon aria-hidden="true" />
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="panel">
          <div className="search-loading">
            <span className="spinner" aria-hidden="true" />
            <p>
              {loadingMode === "load" ? (
                <>
                  Loading saved leads for {service} in {location}…
                </>
              ) : (
                <>
                  Scraping {service} in {location}
                  {deep ? " (deep coverage — this can take up to a minute)…" : "…"}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {!loading && leads && meta && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">
                {meta.service} · {meta.location}
              </h2>
              <p className="results-sub">
                Showing {filteredLeads.length} of {leads.length} leads ·{" "}
                {noWebsiteCount} without a website
              </p>
            </div>
            <div className="results-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={doCsv}
                disabled={!filteredLeads.length}
              >
                <DownloadIcon aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void doXlsx()}
                disabled={!filteredLeads.length || exporting}
              >
                <DownloadIcon aria-hidden="true" />
                {exporting ? "Exporting…" : "Excel"}
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-bar__group">
              <label className="filter-bar__label" htmlFor="f-rating">
                Rating
              </label>
              <select
                id="f-rating"
                className="filter-select"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
              >
                {RATING_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-bar__group">
              <label className="filter-bar__label" htmlFor="f-min-rev">
                Reviews
              </label>
              <input
                id="f-min-rev"
                className="filter-input"
                type="number"
                min={0}
                placeholder="min"
                value={minReviews}
                onChange={(e) => setMinReviews(e.target.value)}
              />
              <span className="filter-bar__dash">–</span>
              <input
                className="filter-input"
                type="number"
                min={0}
                placeholder="max"
                value={maxReviews}
                onChange={(e) => setMaxReviews(e.target.value)}
                aria-label="Max reviews"
              />
            </div>

            <div className="filter-bar__group">
              <label className="filter-bar__label" htmlFor="f-website">
                Website
              </label>
              <select
                id="f-website"
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
              <button type="button" className="filter-bar__reset" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>

          {filteredLeads.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">
                {leads.length === 0 ? "No results" : "No leads match your filters"}
              </h3>
              <p className="empty-state__text">
                {leads.length === 0
                  ? "Try a broader location or a different service term."
                  : "Loosen the filters above to see more leads."}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th className="num">Rating</th>
                    <th className="num">Reviews</th>
                    <th className="num">Score</th>
                    <th>Called</th>
                    <th>Follow up</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l, i) => (
                    <tr
                      key={l.place_id || `${l.name}-${i}`}
                      className={
                        isCalled(l.outreach_status)
                          ? "lead-table__row--called"
                          : undefined
                      }
                    >
                      <td className="num muted">{i + 1}</td>
                      <td>
                        <LeadNameCell
                          name={l.name}
                          address={l.address}
                          mapsUri={l.maps_uri}
                          hours={l.hours}
                          status={l.status}
                        />
                      </td>
                      <td>
                        {l.phone ? (
                          <LeadPhone phone={l.phone} name={l.name} placeId={l.place_id} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {l.website ? (
                          <a href={l.website} target="_blank" rel="noreferrer" className="lead-link">
                            Visit
                          </a>
                        ) : (
                          <span className="badge badge--warn">No site</span>
                        )}
                      </td>
                      <td className="num">{l.rating ?? "—"}</td>
                      <td className="num muted">{l.reviews}</td>
                      <td className="num">
                        <span className="score">{l.score.toFixed(2)}</span>
                      </td>
                      <td>
                        <label className="called-toggle">
                          <input
                            type="checkbox"
                            checked={isCalled(l.outreach_status)}
                            disabled={!l.place_id}
                            onChange={(e) =>
                              toggleCalled(l.place_id, e.target.checked)
                            }
                            aria-label={`Mark ${l.name} as called`}
                          />
                          <span className="called-toggle__track" aria-hidden="true" />
                        </label>
                      </td>
                      <td>
                        <label className="called-toggle called-toggle--follow">
                          <input
                            type="checkbox"
                            checked={!!l.follow_up}
                            disabled={!l.place_id}
                            onChange={(e) =>
                              toggleFollowUp(l.place_id, e.target.checked)
                            }
                            aria-label={`Mark ${l.name} for follow up`}
                          />
                          <span className="called-toggle__track" aria-hidden="true" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && !leads && !error && (
        <section className="panel">
          <div className="empty-state">
            <span className="empty-state__icon">
              <SearchIcon aria-hidden="true" />
            </span>
            <h3 className="empty-state__title">Find your next leads</h3>
            <p className="empty-state__text">
              Pick a service and enter a city. We'll pull local businesses ranked
              by a quality score, with phone numbers and websites ready to export.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
