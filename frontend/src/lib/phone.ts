/** Normalize and display US-centric phone numbers for the dialer. */

const NON_DIGIT = /\D/g;

export function toDialable(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(NON_DIGIT, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return digits;
}

/** Digits (and a leading +) as typed on the pad. */
export function sanitizePadInput(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(NON_DIGIT, "").slice(0, 15);
}

export function formatPadDisplay(raw: string): string {
  if (/[*#]/.test(raw)) return raw;
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(NON_DIGIT, "");
  if (!digits) return plus ? "+" : "";
  if (plus && digits.startsWith("1")) {
    const rest = formatNational(digits.slice(1));
    return rest ? `+1 ${rest}` : "+1";
  }
  if (plus) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${formatNational(digits.slice(1))}`;
  }
  return formatNational(digits);
}

function formatNational(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
