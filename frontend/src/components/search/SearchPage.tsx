import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  DownloadIcon,
  SearchIcon,
} from "@/components/icons";
import { LocationAutocomplete } from "@/components/search/LocationAutocomplete";
import { ApiError } from "@/lib/api/client";
import {
  exportXlsx,
  listServices,
  runSearch,
  type Lead,
  type ServicePreset,
} from "@/lib/api/leads";
import { downloadBlob, leadsToCsv, slug } from "@/lib/csv";

const RADIUS_OPTIONS = [
  { value: 8, label: "5 mi" },
  { value: 15, label: "10 mi" },
  { value: 25, label: "15 mi" },
  { value: 40, label: "25 mi" },
  { value: 80, label: "50 mi" },
];

const RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 3, label: "3.0+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

type WebsiteFilter = "any" | "yes" | "no";

export function SearchPage() {
  const [services, setServices] = useState<ServicePreset[]>([]);
  const [service, setService] = useState("HVAC");
  const [location, setLocation] = useState("");
  const [deep, setDeep] = useState(true);
  const [radiusKm, setRadiusKm] = useState(15);

  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({
        service,
        location: location.trim(),
        deep,
        radius_km: radiusKm,
      });
      setLeads(res.leads);
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

        <div className="search-form__field search-form__field--radius">
          <label className="field-label" htmlFor="radius">
            Radius
          </label>
          <select
            id="radius"
            className="text-input"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            disabled={loading}
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <label className="search-form__deep" title="Tiles a grid for deeper coverage (slower)">
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
          />
          <span>Deep search</span>
        </label>

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
              Scraping {service} in {location}
              {deep ? " (deep coverage — this can take up to a minute)…" : "…"}
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
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l, i) => (
                    <tr key={`${l.name}-${i}`}>
                      <td className="num muted">{i + 1}</td>
                      <td>
                        <a href={l.maps_uri} target="_blank" rel="noreferrer" className="lead-name">
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
