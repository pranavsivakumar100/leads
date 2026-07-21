import { useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { CampaignsPage } from "@/components/campaigns/CampaignsPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { LeadsPage } from "@/components/leads/LeadsPage";
import { SearchPage, type SavedSearchRef } from "@/components/search/SearchPage";
import { SkillsPage } from "@/components/skills/SkillsPage";
import { SessionsPage } from "@/components/sessions/SessionsPage";
import { CheckIcon, SparkIcon } from "@/components/icons";
import { config } from "@/config";
import { useAuth } from "@/hooks/useAuth";

import { Sidebar, type Tab } from "./Sidebar";

export function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState<SavedSearchRef | null>(null);

  if (loading) {
    return (
      <div className="splash">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <div className="gate">
          <div className="gate__inner">
            <section className="gate__intro">
              <a className="gate__brand" href={config.landingUrl}>
                <span className="gate__mark">
                  <SparkIcon aria-hidden="true" />
                </span>
                <span className="gate__wordmark">Leadflow</span>
              </a>
              <h1 className="gate__headline">
                Local business leads,
                <br />
                ranked and ready to call.
              </h1>
              <p className="gate__lede">
                Search any service in any city. Get scored leads with phone
                numbers and websites, then export the list in one click.
              </p>
              <ul className="gate__points">
                {[
                  "Every result scored by review quality",
                  "Deep coverage across a whole metro",
                  "Export straight to CSV or Excel",
                ].map((point) => (
                  <li key={point} className="gate__point">
                    <CheckIcon aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="gate__panel">
              <h2 className="gate__panel-title">Get started</h2>
              <p className="gate__panel-sub">
                Sign in to open your dashboard and run your first search.
              </p>
              <button
                type="button"
                className="btn btn--primary gate__cta"
                onClick={() => setAuthOpen(true)}
              >
                Sign in to continue
              </button>
              <p className="gate__fineprint">
                Email sign-in — no credit card required.
              </p>
            </aside>
          </div>
        </div>
        {authOpen && (
          <AuthModal mode="login" onClose={() => setAuthOpen(false)} />
        )}
      </>
    );
  }

  const email = session.user.email ?? null;
  const userMeta = (session.user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
  };
  // Prefer a real name from the auth provider; fall back to the email handle.
  const userName =
    userMeta.full_name?.trim() ||
    userMeta.name?.trim() ||
    (email ? email.split("@")[0] : "Account");

  const goToSearch = () => {
    setSavedSearch(null);
    setTab("search");
  };

  const openSavedSearch = (ref: SavedSearchRef) => {
    setSavedSearch(ref);
    setTab("search");
  };

  const handleTabChange = (next: Tab) => {
    // Selecting Search from the sidebar starts a fresh search.
    if (next === "search") setSavedSearch(null);
    setTab(next);
  };

  return (
    <div className={`app-layout${sidebarCollapsed ? " app-layout--sidebar-collapsed" : ""}`}>
      <Sidebar
        activeTab={tab}
        collapsed={sidebarCollapsed}
        userName={userName}
        userEmail={email}
        onTabChange={handleTabChange}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSignOut={() => void signOut()}
      />
      <div className="app-main">
        <div className="app-content">
          {tab === "dashboard" && (
            <DashboardPage
              onNewSearch={goToSearch}
              onOpenSearch={openSavedSearch}
            />
          )}
          {tab === "search" && <SearchPage savedSearch={savedSearch} />}
          {tab === "leads" && <LeadsPage onNewSearch={goToSearch} />}
          {tab === "campaigns" && (
            <CampaignsPage onGoToLeads={() => setTab("leads")} />
          )}
          {tab === "sessions" && (
            <SessionsPage onGoToScripts={() => setTab("skills")} />
          )}
          {tab === "skills" && <SkillsPage />}
        </div>
      </div>
    </div>
  );
}
