import { config } from "@/config";
import { apiFetch, ApiError } from "@/lib/api/client";
import { supabase } from "@/lib/supabase";

export type OutreachStatus = "new" | "contacted" | "interested" | "passed";

export interface Lead {
  place_id: string;
  name: string;
  phone: string;
  website: string;
  address: string;
  rating: number | null;
  reviews: number;
  score: number;
  has_website: boolean;
  status: string;
  maps_uri: string;
  /** Present on saved/library leads; defaults to "new" on fresh scrapes. */
  outreach_status?: OutreachStatus;
  /** Flag for needs-a-follow-up; independent of Called. */
  follow_up?: boolean;
}

export interface ServicePreset {
  label: string;
  query: string;
}

export interface LocationSuggestion {
  place_id: string;
  label: string;
  main_text: string;
  secondary_text: string;
}

export interface LeadSearchResponse {
  service: string;
  location: string;
  total: number;
  leads: Lead[];
  search_id: string | null;
}

export interface SearchHistoryItem {
  id: string;
  service: string;
  location: string;
  deep: boolean;
  radius_km: number | null;
  total_results: number;
  created_at: string;
}

export interface DashboardStats {
  total_leads: number;
  searches_run: number;
  markets: number;
  avg_leads_per_search: number;
}

export interface LeadSearchParams {
  service: string;
  location: string;
  deep: boolean;
  max_results?: number;
  radius_km?: number;
}

export function listServices(): Promise<ServicePreset[]> {
  return apiFetch<ServicePreset[]>("/search/services");
}

export function autocompleteLocations(input: string): Promise<LocationSuggestion[]> {
  const q = encodeURIComponent(input.trim());
  return apiFetch<LocationSuggestion[]>(`/search/locations/autocomplete?input=${q}`);
}

export function listHistory(limit = 8): Promise<SearchHistoryItem[]> {
  return apiFetch<SearchHistoryItem[]>(`/history?limit=${limit}`);
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/history/stats");
}

export function getSavedLeads(searchId: string): Promise<Lead[]> {
  return apiFetch<Lead[]>(`/history/${searchId}/leads`);
}

export interface LibraryLead extends Lead {
  outreach_status: OutreachStatus;
  follow_up: boolean;
  service: string;
  location: string;
  times_seen: number;
  created_at: string;
}

export function listLibraryLeads(): Promise<LibraryLead[]> {
  return apiFetch<LibraryLead[]>("/leads");
}

export function setLeadStatus(
  placeId: string,
  status: OutreachStatus,
): Promise<void> {
  return apiFetch<void>(`/leads/${encodeURIComponent(placeId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function setLeadFollowUp(
  placeId: string,
  followUp: boolean,
): Promise<void> {
  return apiFetch<void>(`/leads/${encodeURIComponent(placeId)}/follow-up`, {
    method: "PATCH",
    body: JSON.stringify({ follow_up: followUp }),
  });
}

export interface CampaignStatusCounts {
  new: number;
  contacted: number;
  interested: number;
  passed: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  created_at: string;
  lead_count: number;
  status_counts: CampaignStatusCounts;
}

export function listCampaigns(): Promise<Campaign[]> {
  return apiFetch<Campaign[]>("/campaigns");
}

export function createCampaign(
  name: string,
  description = "",
): Promise<Campaign> {
  return apiFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export function deleteCampaign(campaignId: string): Promise<void> {
  return apiFetch<void>(`/campaigns/${campaignId}`, { method: "DELETE" });
}

export function getCampaignLeads(campaignId: string): Promise<LibraryLead[]> {
  return apiFetch<LibraryLead[]>(`/campaigns/${campaignId}/leads`);
}

export function addLeadsToCampaign(
  campaignId: string,
  placeIds: string[],
): Promise<void> {
  return apiFetch<void>(`/campaigns/${campaignId}/leads`, {
    method: "POST",
    body: JSON.stringify({ place_ids: placeIds }),
  });
}

export function removeLeadFromCampaign(
  campaignId: string,
  placeId: string,
): Promise<void> {
  return apiFetch<void>(
    `/campaigns/${campaignId}/leads/${encodeURIComponent(placeId)}`,
    { method: "DELETE" },
  );
}

export function runSearch(params: LeadSearchParams): Promise<LeadSearchResponse> {
  return apiFetch<LeadSearchResponse>("/search", {
    method: "POST",
    body: JSON.stringify({ max_results: 300, ...params }),
  });
}

/** Download a formatted .xlsx of the given leads via the backend. */
export async function exportXlsx(
  service: string,
  location: string,
  leads: Lead[],
): Promise<Blob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${config.apiBaseUrl}/search/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ service, location, leads }),
  });
  if (!res.ok) {
    throw new ApiError("Export failed", res.status);
  }
  return res.blob();
}
