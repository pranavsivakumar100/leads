import { useEffect, useMemo, useState } from "react";

import { LeadPhone } from "@/components/dialer/LeadPhone";
import { FlagIcon, SearchIcon, UsersIcon } from "@/components/icons";
import {
  listLibraryLeads,
  setLeadFollowUp,
  setLeadStatus,
  type LibraryLead,
  type OutreachStatus,
} from "@/lib/api/leads";
import { onCrmLeadPatch } from "@/lib/crmEvents";

const STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "passed", label: "Passed" },
];

const QUEUE_RANK: Record<OutreachStatus, number> = {
  interested: 0,
  contacted: 1,
  new: 2,
  passed: 3,
};

type QueueFilter = "all" | OutreachStatus;

interface FollowUpPageProps {
  onNewSearch: () => void;
  onGoToLeads: () => void;
}

export function FollowUpPage({ onNewSearch, onGoToLeads }: FollowUpPageProps) {
  const [leads, setLeads] = useState<LibraryLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");

  const refresh = () =>
    listLibraryLeads()
      .then(setLeads)
      .catch(() => setError("Couldn't load follow-ups."));

  useEffect(() => {
    void refresh();
    return onCrmLeadPatch(() => {
      void refresh();
    });
  }, []);

  const queue = useMemo(() => {
    if (!leads) return [];
    return leads
      .filter((l) => l.follow_up)
      .sort((a, b) => {
        const rank =
          QUEUE_RANK[a.outreach_status] - QUEUE_RANK[b.outreach_status];
        if (rank !== 0) return rank;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });
  }, [leads]);

  const counts = useMemo(() => {
    const next = { all: queue.length, new: 0, contacted: 0, interested: 0, passed: 0 };
    for (const lead of queue) {
      next[lead.outreach_status] += 1;
    }
    return next;
  }, [queue]);

  const visible = useMemo(
    () => (filter === "all" ? queue : queue.filter((l) => l.outreach_status === filter)),
    [filter, queue],
  );

  const changeStatus = (placeId: string, status: OutreachStatus) => {
    const previous = leads?.find((l) => l.place_id === placeId)?.outreach_status;
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

  const clearFollowUp = (placeId: string) => {
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.place_id === placeId ? { ...l, follow_up: false } : l,
          )
        : prev,
    );
    setLeadFollowUp(placeId, false).catch(() => {
      setLeads((prev) =>
        prev
          ? prev.map((l) =>
              l.place_id === placeId ? { ...l, follow_up: true } : l,
            )
          : prev,
      );
      setError("Couldn't clear follow-up. Try again.");
    });
  };

  const loading = leads === null && !error;

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
            <p>Loading follow-ups…</p>
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
              Run a search, then flag Follow up on anyone you still owe a call.
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

      {leads && leads.length > 0 && queue.length === 0 && (
        <section className="panel">
          <div className="empty-state">
            <span className="empty-state__icon">
              <FlagIcon aria-hidden="true" />
            </span>
            <h3 className="empty-state__title">Queue is clear</h3>
            <p className="empty-state__text">
              Flag Follow up on Search or in your library and those businesses
              land here.
            </p>
            <button
              type="button"
              className="btn btn--primary empty-state__cta"
              onClick={onGoToLeads}
            >
              Open library
            </button>
          </div>
        </section>
      )}

      {leads && queue.length > 0 && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Follow-up</h2>
              <p className="results-sub">
                {queue.length} business{queue.length === 1 ? "" : "es"} you still
                owe a conversation
              </p>
            </div>
          </div>

          <div className="crm-chips" aria-label="Pipeline">
            {(
              [
                ["all", "All"],
                ["interested", "Interested"],
                ["contacted", "Contacted"],
                ["new", "New"],
                ["passed", "Passed"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                className={`crm-chip${filter === id ? " crm-chip--on" : ""}`}
                onClick={() => setFilter(id)}
              >
                {label}
                <span className="crm-chip__count">{counts[id]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <h3 className="empty-state__title">Nothing in this column</h3>
              <p className="empty-state__text">
                Try another status, or clear the filter to see the full queue.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Found via</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
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
                        <div>{l.service}</div>
                        <div className="lead-address">{l.location}</div>
                      </td>
                      <td>
                        {l.phone ? (
                          <LeadPhone phone={l.phone} name={l.name} placeId={l.place_id} />
                        ) : (
                          <span className="muted">—</span>
                        )}
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
                          className="btn btn--secondary crm-done"
                          onClick={() => clearFollowUp(l.place_id)}
                        >
                          Done
                        </button>
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
