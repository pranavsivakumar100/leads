import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import {
  BookIcon,
  DashboardIcon,
  FlagIcon,
  LogOutIcon,
  MoonIcon,
  PanelToggleIcon,
  PhoneIcon,
  SearchIcon,
  SettingsIcon,
  SparkIcon,
  SunIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/icons";
import { useTheme } from "@/hooks/useTheme";

export type Tab =
  | "dashboard"
  | "search"
  | "followup"
  | "leads"
  | "campaigns"
  | "sessions"
  | "skills"
  | "settings";

type NavEntry = {
  id: Exclude<Tab, "settings">;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavEntry[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "find",
    label: "Find",
    items: [
      { id: "dashboard", label: "Dashboard", Icon: DashboardIcon },
      { id: "search", label: "Search", Icon: SearchIcon },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { id: "followup", label: "Follow-up", Icon: FlagIcon },
      { id: "leads", label: "Leads", Icon: UsersIcon },
      { id: "campaigns", label: "Campaigns", Icon: TargetIcon },
    ],
  },
  {
    id: "call",
    label: "Call",
    items: [{ id: "sessions", label: "Sessions", Icon: PhoneIcon }],
  },
  {
    id: "prep",
    label: "Prep",
    items: [{ id: "skills", label: "Skills", Icon: BookIcon }],
  },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        {NAV_GROUPS.map((group) => (
          <div
            key={group.id}
            className="sidebar__nav-group"
            role="group"
            aria-label={group.label}
          >
            {!collapsed && (
              <div className="sidebar__section-label">{group.label}</div>
            )}
            {group.items.map(({ id, label, Icon }) => (
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
          </div>
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
        <div className="sidebar__user-wrap" ref={menuRef}>
          {menuOpen && (
            <div className="account-menu" role="menu" aria-label="Account">
              <button
                type="button"
                role="menuitem"
                className="account-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onTabChange("settings");
                }}
              >
                <SettingsIcon aria-hidden="true" />
                Settings
              </button>
              <div className="account-menu__sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="account-menu__item account-menu__item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
              >
                <LogOutIcon aria-hidden="true" />
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            className={`sidebar__user${menuOpen || activeTab === "settings" ? " sidebar__user--open" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? "Account" : undefined}
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
      </div>
    </aside>
  );
}
