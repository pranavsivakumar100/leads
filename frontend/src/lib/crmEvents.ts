import type { OutreachStatus } from "@/lib/api/leads";

export type CrmLeadPatch = {
  placeId: string;
  followUp?: boolean;
  outreachStatus?: OutreachStatus;
};

const EVENT = "leadflow:crm-lead";

export function emitCrmLeadPatch(patch: CrmLeadPatch): void {
  window.dispatchEvent(new CustomEvent<CrmLeadPatch>(EVENT, { detail: patch }));
}

export function onCrmLeadPatch(handler: (patch: CrmLeadPatch) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<CrmLeadPatch>).detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
