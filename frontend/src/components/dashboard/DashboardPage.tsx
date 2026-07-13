import type { ComponentType, SVGProps } from "react";

import {
  DownloadIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  TrendUpIcon,
  UsersIcon,
} from "@/components/icons";

type Kpi = {
  label: string;
  value: string;
  meta: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const KPIS: Kpi[] = [
  { label: "Total leads", value: "0", meta: "Across all searches", Icon: UsersIcon },
  { label: "Searches run", value: "0", meta: "Lifetime", Icon: SearchIcon },
  { label: "Markets", value: "0", meta: "Cities scraped", Icon: MapPinIcon },
  { label: "Exports", value: "0", meta: "CSV / Excel", Icon: DownloadIcon },
];

interface DashboardPageProps {
  onNewSearch: () => void;
}

export function DashboardPage({ onNewSearch }: DashboardPageProps) {
  return (
    <div className="dashboard">
      <section className="kpi-grid" aria-label="Overview">
        {KPIS.map(({ label, value, meta, Icon }) => (
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
        </div>
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
      </section>
    </div>
  );
}
