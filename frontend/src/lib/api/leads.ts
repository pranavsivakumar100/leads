import { config } from "@/config";
import { apiFetch, ApiError } from "@/lib/api/client";
import { supabase } from "@/lib/supabase";

export interface Lead {
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
