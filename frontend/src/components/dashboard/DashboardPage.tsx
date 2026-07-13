import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import {
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  TrendUpIcon,
  UsersIcon,
} from "@/components/icons";
import type { SavedSearchRef } from "@/components/search/SearchPage";
import {
  getDashboardStats,
  listHistory,
  type DashboardStats,
  type SearchHistoryItem,
} from "@/lib/api/leads";

type Kpi = {
  label: string;
  value: string;
  meta: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

function buildKpis(stats: DashboardStats | null): Kpi[] {
  return [
    {
      label: "Total leads",
      value: stats ? stats.total_leads.toLocaleString() : "—",
      meta: "Across all searches",
      Icon: UsersIcon,
    },
    {
      label: "Searches run",
      value: stats ? stats.searches_run.toLocaleString() : "—",
      meta: "Lifetime",
      Icon: SearchIcon,
    },
    {
      label: "Markets",
      value: stats ? stats.markets.toLocaleString() : "—",
      meta: "Cities scraped",
      Icon: MapPinIcon,
    },
    {
      label: "Avg leads / search",
      value: stats ? stats.avg_leads_per_search.toLocaleString() : "—",
      meta: "Higher with deep search",
      Icon: TrendUpIcon,
    },
  ];
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface DashboardPageProps {
  onNewSearch: () => void;
  onOpenSearch: (ref: SavedSearchRef) => void;
}

export function DashboardPage({ onNewSearch, onOpenSearch }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDashboardStats(), listHistory(8)])
      .then(([s, h]) => {
        if (cancelled) return;
        setStats(s);
        setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load dashboard data.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = history === null && !error;

  return (
    <div className="dashboard">
      <section className="kpi-grid" aria-label="Overview">
        {buildKpis(stats).map(({ label, value, meta, Icon }) => (
          <article key={label} className="kpi-card">
            <div className="kpi-card__top">
              <span className="kpi-card__label">{label}</span>
              <span className="kpi-card__icon">
                <Icon aria-hidden="true" />
              </span>
            </div>
            <div className="kpi-card__value">{value}</div>
            <div className="kpi-card__meta">{meta}</div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Recent searches</h2>
          {history && history.length > 0 && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onNewSearch}
            >
              <PlusIcon aria-hidden="true" />
              New search
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="empty-state">
            <span className="spinner" aria-label="Loading" />
          </div>
        )}

        {history && history.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon">
              <TrendUpIcon aria-hidden="true" />
            </span>
            <h3 className="empty-state__title">No searches yet</h3>
            <p className="empty-state__text">
              Run your first lead search to pull local businesses with phone
              numbers, websites, and quality scores — ready to export.
            </p>
            <button
              type="button"
              className="btn btn--primary empty-state__cta"
              onClick={onNewSearch}
            >
              <PlusIcon aria-hidden="true" />
              New search
            </button>
          </div>
        )}

        {history && history.length > 0 && (
          <div className="table-wrap">
            <table className="lead-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Mode</th>
                  <th className="num">Leads</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className="lead-table__row--clickable"
                    onClick={() =>
                      onOpenSearch({
                        id: h.id,
                        service: h.service,
                        location: h.location,
                      })
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenSearch({
                          id: h.id,
                          service: h.service,
                          location: h.location,
                        });
                      }
                    }}
                  >
                    <td>
                      <span className="lead-name">{h.service}</span>
                    </td>
                    <td>{h.location}</td>
                    <td>
                      {h.deep ? (
                        <span className="badge badge--deep">Deep</span>
                      ) : (
                        <span className="muted">Standard</span>
                      )}
                    </td>
                    <td className="num">{h.total_results.toLocaleString()}</td>
                    <td className="muted">{formatWhen(h.created_at)}</td>
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
