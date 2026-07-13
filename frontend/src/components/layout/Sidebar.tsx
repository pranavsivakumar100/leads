import type { ComponentType, SVGProps } from "react";

import {
  BookIcon,
  DashboardIcon,
  LogOutIcon,
  PanelToggleIcon,
  PhoneIcon,
  SearchIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";

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
  userEmail: string | null;
  onTabChange: (tab: Tab) => void;
  onToggleCollapse: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  activeTab,
  collapsed,
  userEmail,
  onTabChange,
  onToggleCollapse,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar__header">
        {!collapsed && (
          <div className="sidebar__logo">
            <span className="sidebar__logo-mark">
              <TargetIcon aria-hidden="true" />
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
        <div className="sidebar__user">
          <span className="sidebar__avatar" aria-hidden="true">
            {(userEmail ?? "?").charAt(0)}
          </span>
          {!collapsed && (
            <>
              <span className="sidebar__user-email" title={userEmail ?? undefined}>
                {userEmail ?? "Account"}
              </span>
              <button
                type="button"
                className="sidebar__signout"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOutIcon aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
