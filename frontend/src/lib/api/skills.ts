import { apiFetch, ApiError } from "@/lib/api/client";
import { config } from "@/config";
import { supabase } from "@/lib/supabase";

export interface KnowledgeDoc {
  id: string;
  name: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  coach_enabled: boolean;
  created_at: string;
}

export function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  return apiFetch<KnowledgeDoc[]>("/skills/docs");
}

export async function uploadKnowledgeDoc(file: File): Promise<KnowledgeDoc> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${config.apiBaseUrl}/skills/docs`, {
    method: "POST",
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    body,
  });
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
  return response.json() as Promise<KnowledgeDoc>;
}

export function setKnowledgeCoachEnabled(
  docId: string,
  coachEnabled: boolean,
): Promise<KnowledgeDoc> {
  return apiFetch<KnowledgeDoc>(`/skills/docs/${docId}`, {
    method: "PATCH",
    body: JSON.stringify({ coach_enabled: coachEnabled }),
  });
}

export function deleteKnowledgeDoc(docId: string): Promise<void> {
  return apiFetch<void>(`/skills/docs/${docId}`, { method: "DELETE" });
}
