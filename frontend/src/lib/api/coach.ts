import { apiFetch, ApiError } from "@/lib/api/client";
import { config } from "@/config";
import { supabase } from "@/lib/supabase";

export interface ScriptStep {
  title: string;
  body: string;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  steps: ScriptStep[];
  created_at: string;
  updated_at: string;
}

export function listScripts(): Promise<Script[]> {
  return apiFetch<Script[]>("/scripts");
}

export function createScript(
  name: string,
  description: string,
  steps: ScriptStep[],
): Promise<Script> {
  return apiFetch<Script>("/scripts", {
    method: "POST",
    body: JSON.stringify({ name, description, steps }),
  });
}

export function updateScript(
  scriptId: string,
  patch: Partial<Pick<Script, "name" | "description" | "steps">>,
): Promise<Script> {
  return apiFetch<Script>(`/scripts/${scriptId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteScript(scriptId: string): Promise<void> {
  return apiFetch<void>(`/scripts/${scriptId}`, { method: "DELETE" });
}

export type OfferFitType =
  | "any"
  | "no_website"
  | "few_reviews"
  | "low_rating"
  | "high_volume";

export interface Offer {
  id: string;
  name: string;
  description: string;
  pricing: string;
  fit_type: OfferFitType;
  created_at: string;
  updated_at: string;
}

export function listOffers(): Promise<Offer[]> {
  return apiFetch<Offer[]>("/offers");
}

export function createOffer(input: {
  name: string;
  description?: string;
  pricing?: string;
  fit_type?: OfferFitType;
}): Promise<Offer> {
  return apiFetch<Offer>("/offers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOffer(
  offerId: string,
  patch: Partial<Pick<Offer, "name" | "description" | "pricing" | "fit_type">>,
): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteOffer(offerId: string): Promise<void> {
  return apiFetch<void>(`/offers/${offerId}`, { method: "DELETE" });
}

export type SessionOutcome =
  | "in_progress"
  | "connected"
  | "interested"
  | "not_interested"
  | "callback"
  | "voicemail"
  | "no_answer"
  | "meeting_booked";

export type EventRole = "prospect" | "rep" | "coach" | "system";

export interface SessionEvent {
  id: string;
  role: EventRole;
  text: string;
  t_ms: number;
  created_at: string;
}

export interface CallSession {
  id: string;
  lead_place_id: string;
  lead_name: string;
  campaign_id: string | null;
  script_id: string | null;
  offer: string;
  outcome: SessionOutcome;
  notes: string;
  started_at: string;
  ended_at: string | null;
  event_count: number;
}

export interface CallSessionDetail extends CallSession {
  events: SessionEvent[];
}

export function listSessions(): Promise<CallSession[]> {
  return apiFetch<CallSession[]>("/sessions");
}

export function getSession(sessionId: string): Promise<CallSessionDetail> {
  return apiFetch<CallSessionDetail>(`/sessions/${sessionId}`);
}

export interface CreateSessionInput {
  lead_place_id?: string;
  lead_name?: string;
  campaign_id?: string | null;
  script_id?: string | null;
  offer?: string;
}

export function createSession(
  input: CreateSessionInput,
): Promise<CallSessionDetail> {
  return apiFetch<CallSessionDetail>("/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSession(
  sessionId: string,
  patch: {
    outcome?: SessionOutcome;
    notes?: string;
    offer?: string;
    ended?: boolean;
  },
): Promise<CallSessionDetail> {
  return apiFetch<CallSessionDetail>(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/sessions/${sessionId}`, { method: "DELETE" });
}

export interface TranscriptTurn {
  role: "prospect" | "rep";
  text: string;
}

/** Ask the AI coach for the rep's next line. Also saved as a coach event. */
export function coachNextLine(
  sessionId: string,
  transcript: TranscriptTurn[],
): Promise<{ text: string }> {
  return apiFetch<{ text: string }>(`/sessions/${sessionId}/coach`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

export function addSessionEvent(
  sessionId: string,
  event: { role: EventRole; text: string; t_ms?: number },
): Promise<SessionEvent> {
  return apiFetch<SessionEvent>(`/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({ t_ms: 0, ...event }),
  });
}

export async function transcribeUtterance(
  sessionId: string,
  blob: Blob,
  filename: string,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const body = new FormData();
  body.append("file", blob, filename);
  const response = await fetch(
    `${config.apiBaseUrl}/sessions/${sessionId}/transcribe`,
    {
      method: "POST",
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      body,
    },
  );
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // keep status text
    }
    throw new ApiError(detail, response.status);
  }
  const payload = (await response.json()) as { text?: string };
  return (payload.text || "").trim();
}
