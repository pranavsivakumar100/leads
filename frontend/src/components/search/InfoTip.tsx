import type { ReactNode } from "react";

import { InfoIcon } from "@/components/icons";

interface InfoTipProps {
  label: string;
  children: ReactNode;
  /** Tooltip opens above or below the icon. Default: bottom (better in the search bar). */
  placement?: "top" | "bottom";
}

/** Small (i) icon — shows a tooltip on hover or keyboard focus. */
export function InfoTip({
  label,
  children,
  placement = "bottom",
}: InfoTipProps) {
  return (
    <span className={`info-tip info-tip--${placement}`}>
      <button
        type="button"
        className="info-tip__btn"
        aria-label={label}
        tabIndex={0}
      >
        <InfoIcon aria-hidden="true" />
      </button>
      <span className="info-tip__pop" role="tooltip">
        {children}
      </span>
    </span>
  );
}
