import type { OfferFitType } from "@/lib/api/coach";
import type { LibraryLead } from "@/lib/api/leads";

export type FitTier = "strong" | "medium" | "low";

export interface FitResult {
  score: number; // 0–100
  tier: FitTier;
  reason: string;
}

export const FIT_TYPE_META: Record<
  OfferFitType,
  { label: string; hint: string }
> = {
  any: {
    label: "Any business",
    hint: "No specific targeting — every lead scores neutrally.",
  },
  no_website: {
    label: "Businesses with no website",
    hint: "Best for website builds or offers that replace a web presence.",
  },
  few_reviews: {
    label: "Few / no reviews",
    hint: "Best for review-generation and reputation offers.",
  },
  low_rating: {
    label: "Low rating",
    hint: "Best for reputation repair and review-management offers.",
  },
  high_volume: {
    label: "High call volume (busy)",
    hint: "Best for receptionist / missed-call offers — busy shops miss calls.",
  },
};

function tierFor(score: number): FitTier {
  if (score >= 70) return "strong";
  if (score >= 40) return "medium";
  return "low";
}

/** Score how well a lead fits an offer, using signals we already scrape. */
export function scoreFit(lead: LibraryLead, fitType: OfferFitType): FitResult {
  const reviews = lead.reviews ?? 0;
  const rating = lead.rating;

  let score = 50;
  let reason = "";

  switch (fitType) {
    case "no_website":
      score = lead.has_website ? 12 : 95;
      reason = lead.has_website ? "Already has a website" : "No website";
      break;

    case "few_reviews":
      if (reviews === 0) {
        score = 92;
        reason = "No reviews yet";
      } else if (reviews <= 5) {
        score = 82;
        reason = `Only ${reviews} reviews`;
      } else if (reviews <= 15) {
        score = 60;
        reason = `${reviews} reviews`;
      } else if (reviews <= 40) {
        score = 38;
        reason = `${reviews} reviews`;
      } else {
        score = 18;
        reason = "Plenty of reviews";
      }
      break;

    case "low_rating":
      if (rating == null) {
        score = 45;
        reason = "No rating yet";
      } else if (rating <= 3.0) {
        score = 92;
        reason = `${rating.toFixed(1)}★ rating`;
      } else if (rating <= 3.7) {
        score = 76;
        reason = `${rating.toFixed(1)}★ rating`;
      } else if (rating <= 4.2) {
        score = 50;
        reason = `${rating.toFixed(1)}★ rating`;
      } else if (rating <= 4.6) {
        score = 30;
        reason = `${rating.toFixed(1)}★ rating`;
      } else {
        score = 14;
        reason = "Strong rating already";
      }
      break;

    case "high_volume":
      if (reviews >= 200) {
        score = 90;
        reason = `${reviews} reviews — very busy`;
      } else if (reviews >= 100) {
        score = 78;
        reason = `${reviews} reviews — busy`;
      } else if (reviews >= 40) {
        score = 58;
        reason = `${reviews} reviews`;
      } else if (reviews >= 15) {
        score = 38;
        reason = `${reviews} reviews`;
      } else {
        score = 20;
        reason = "Low volume signal";
      }
      break;

    case "any":
    default:
      score = 50;
      reason = "";
      break;
  }

  return { score, tier: tierFor(score), reason };
}

export const FIT_TIER_LABEL: Record<FitTier, string> = {
  strong: "Strong fit",
  medium: "Possible fit",
  low: "Weak fit",
};
