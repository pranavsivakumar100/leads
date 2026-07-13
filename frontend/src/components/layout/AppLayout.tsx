import { useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { SearchPage } from "@/components/search/SearchPage";
import { TargetIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";

import { Sidebar, type Tab } from "./Sidebar";
import { TopBar } from "./TopBar";

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Your lead generation at a glance.",
  },
  search: {
    title: "Search",
    subtitle: "Pull ranked local business leads by service and city.",
  },
};

export function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

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
          <div className="gate__card">
            <span className="gate__mark">
              <TargetIcon aria-hidden="true" />
            </span>
            <h1 className="gate__title">Leadflow</h1>
            <p className="gate__subtitle">
              Find and export high-quality local business leads in minutes. Sign
              in to open your dashboard.
            </p>
            <button
              type="button"
              className="btn btn--primary gate__cta"
              onClick={() => setAuthOpen(true)}
            >
              Sign in to continue
            </button>
          </div>
        </div>
        {authOpen && (
          <AuthModal mode="login" onClose={() => setAuthOpen(false)} />
        )}
      </>
    );
  }

  const meta = TAB_META[tab];
  const goToSearch = () => setTab("search");

  return (
    <div className={`app-layout${sidebarCollapsed ? " app-layout--sidebar-collapsed" : ""}`}>
      <Sidebar
        activeTab={tab}
        collapsed={sidebarCollapsed}
        userEmail={session.user.email ?? null}
        onTabChange={setTab}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSignOut={() => void signOut()}
      />
      <div className="app-main">
        <TopBar title={meta.title} subtitle={meta.subtitle} onNewSearch={goToSearch} />
        <div className="app-content">
          {tab === "dashboard" ? (
            <DashboardPage onNewSearch={goToSearch} />
          ) : (
            <SearchPage />
          )}
        </div>
      </div>
    </div>
  );
}
