import type { Lead } from "@/lib/api/leads";

const HEADER = [
  "Rank",
  "Business Name",
  "Phone",
  "Website",
  "Address",
  "Rating",
  "Reviews",
  "Quality Score",
  "Has Website",
  "Status",
  "Google Maps",
];

function cell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map((l, i) =>
    [
      i + 1,
      l.name,
      l.phone,
      l.website,
      l.address,
      l.rating ?? "",
      l.reviews,
      l.score,
      l.has_website ? "Yes" : "No",
      l.status,
      l.maps_uri,
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER.join(","), ...rows].join("\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "leads";
}
