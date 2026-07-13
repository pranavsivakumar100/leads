import { PlusIcon } from "@/components/icons";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onNewSearch: () => void;
}

export function TopBar({ title, subtitle, onNewSearch }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__titles">
        <h1 className="topbar__title">{title}</h1>
        {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
      </div>
      <div className="topbar__actions">
        <button type="button" className="btn btn--primary" onClick={onNewSearch}>
          <PlusIcon aria-hidden="true" />
          New search
        </button>
      </div>
    </header>
  );
}
