import { useState } from "react";

import { OffersPage } from "@/components/offers/OffersPage";
import { ScriptsPage } from "@/components/scripts/ScriptsPage";

type Section = "scripts" | "offers";

interface SkillsPageProps {
  initialSection?: Section;
}

export function SkillsPage({ initialSection = "scripts" }: SkillsPageProps) {
  const [section, setSection] = useState<Section>(initialSection);

  return (
    <div className="skills-page">
      <div className="segmented" role="tablist" aria-label="Skills sections">
        <button
          type="button"
          role="tab"
          aria-selected={section === "scripts"}
          className={`segmented__btn${section === "scripts" ? " segmented__btn--active" : ""}`}
          onClick={() => setSection("scripts")}
        >
          Scripts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "offers"}
          className={`segmented__btn${section === "offers" ? " segmented__btn--active" : ""}`}
          onClick={() => setSection("offers")}
        >
          Offers
        </button>
      </div>

      {section === "scripts" ? <ScriptsPage /> : <OffersPage />}
    </div>
  );
}
