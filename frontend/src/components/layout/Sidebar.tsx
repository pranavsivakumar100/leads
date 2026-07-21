import type { ComponentType, SVGProps } from "react";

import {
  BookIcon,
  DashboardIcon,
  MoonIcon,
  PanelToggleIcon,
  PhoneIcon,
  SearchIcon,
  SparkIcon,
  SunIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";
import { useTheme } from "@/hooks/useTheme";

export type Tab =
  | "dashboard"
  | "search"
  | "leads"
  | "campaigns"
  | "sessions"
  | "skills";

type NavEntry = {
  id: Tab;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const NAV: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon },
  { id: "search", label: "Search", Icon: SearchIcon },
  { id: "leads", label: "Leads", Icon: UsersIcon },
  { id: "campaigns", label: "Campaigns", Icon: TargetIcon },
  { id: "sessions", label: "Sessions", Icon: PhoneIcon },
  { id: "skills", label: "Skills", Icon: BookIcon },
];

interface SidebarProps {
  activeTab: Tab;
  collapsed: boolean;
  userName: string;
  userEmail: string | null;
  onTabChange: (tab: Tab) => void;
  onToggleCollapse: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  activeTab,
  collapsed,
  userName,
  userEmail,
  onTabChange,
  onToggleCollapse,
  onSignOut,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar__header">
        {!collapsed && (
          <div className="sidebar__logo">
            <span className="sidebar__logo-mark">
              <SparkIcon aria-hidden="true" />
            </span>
            Leadflow
          </div>
        )}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <PanelToggleIcon aria-hidden="true" />
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Primary">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item${activeTab === id ? " nav-item--active" : ""}`}
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? "page" : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon className="nav-item__icon" aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}

      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__theme"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <SunIcon aria-hidden="true" />
          ) : (
            <MoonIcon aria-hidden="true" />
          )}
          {!collapsed && (
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          )}
        </button>
        <button
          type="button"
          className="sidebar__user"
          onClick={onSignOut}
          title={collapsed ? "Sign out" : "Click to sign out"}
        >
          <span className="sidebar__avatar" aria-hidden="true">
            {(userName || userEmail || "?").charAt(0)}
          </span>
          {!collapsed && (
            <span className="sidebar__user-meta">
              <span className="sidebar__user-name">{userName}</span>
              {userEmail && (
                <span className="sidebar__user-sub">{userEmail}</span>
              )}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
