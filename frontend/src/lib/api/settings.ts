import { apiFetch } from "@/lib/api/client";

export interface IntegrationStatus {
  configured: boolean;
  hint: string;
  source: "account" | "env" | "none";
}

export interface CoachStatus extends IntegrationStatus {
  model: string;
  base_url: string;
}

export interface VoiceStatus extends IntegrationStatus {
  account_hint: string;
  caller_id: string;
  twiml_hint: string;
  webhook_url: string;
}

export interface SettingsUsage {
  total_leads: number;
  searches_run: number;
  markets: number;
  sessions: number;
  twilio_balance: string | null;
  twilio_currency: string | null;
}

export interface AppSettings {
  email: string | null;
  name: string;
  env_fallback: boolean;
  usage: SettingsUsage;
  search: IntegrationStatus;
  coach: CoachStatus;
  voice: VoiceStatus;
}

export type SettingsPatch = {
  google_maps_api_key?: string;
  openai_api_key?: string;
  coach_model?: string;
  coach_base_url?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_api_key?: string;
  twilio_api_secret?: string;
  twilio_twiml_app_sid?: string;
  twilio_caller_id?: string;
};

export interface CoachModelOption {
  id: string;
  provider: string;
}

export interface CoachModelsResponse {
  models: CoachModelOption[];
  source: "api" | "fallback";
  error: string;
}

export function getSettings(): Promise<AppSettings> {
  return apiFetch<AppSettings>("/settings");
}

export function listCoachModels(): Promise<CoachModelsResponse> {
  return apiFetch<CoachModelsResponse>("/settings/models");
}

export function updateSettings(patch: SettingsPatch): Promise<AppSettings> {
  return apiFetch<AppSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
