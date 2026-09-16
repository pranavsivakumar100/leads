import { apiFetch } from "@/lib/api/client";

export interface VoiceStatus {
  ready: boolean;
  caller_id: string;
}

export interface VoiceToken {
  token: string;
  identity: string;
  caller_id: string;
}

export function getVoiceStatus(): Promise<VoiceStatus> {
  return apiFetch<VoiceStatus>("/voice/status");
}

export function getVoiceToken(): Promise<VoiceToken> {
  return apiFetch<VoiceToken>("/voice/token");
}
