/** Weekly hours from Google Places, used to compute open/closed at render time. */

export interface HoursPoint {
  day: number;
  hour: number;
  minute: number;
}

export interface HoursPeriod {
  open: HoursPoint;
  close?: HoursPoint | null;
}

export interface LeadHours {
  timezone: string;
  periods: HoursPeriod[];
  weekday_text?: string[];
}

export type HoursKind = "open" | "closed" | "temp_closed" | "perm_closed";

export interface HoursStatus {
  kind: HoursKind;
  label: string;
  title: string;
}

const WEEK_MINUTES = 7 * 24 * 60;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const SHORT_DAY: Record<string, number> = {
  Sun: 0,
  Sunday: 0,
  Mon: 1,
  Monday: 1,
  Tue: 2,
  Tuesday: 2,
  Wed: 3,
  Wednesday: 3,
  Thu: 4,
  Thursday: 4,
  Fri: 5,
  Friday: 5,
  Sat: 6,
  Saturday: 6,
};

function weekMinute(point: HoursPoint): number {
  return (
    (((point.day % 7) * 24 + point.hour) * 60 + point.minute + WEEK_MINUTES) %
    WEEK_MINUTES
  );
}

function inPeriod(now: number, open: number, close: number | null): boolean {
  if (close == null || close === open) return true;
  if (close > open) return now >= open && now < close;
  return now >= open || now < close;
}

function formatClock(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  if (minute === 0) return `${h} ${ampm}`;
  return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function localNow(timeZone: string, at: Date): HoursPoint | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(at);
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const day = SHORT_DAY[map.weekday ?? ""];
    let hour = Number(map.hour);
    const minute = Number(map.minute);
    if (hour === 24) hour = 0;
    if (day == null || Number.isNaN(hour) || Number.isNaN(minute) || hour > 23) {
      return null;
    }
    return { day, hour, minute };
  } catch {
    return null;
  }
}

function currentPeriod(
  now: number,
  periods: HoursPeriod[],
): HoursPeriod | null {
  for (const period of periods) {
    const open = weekMinute(period.open);
    const close = period.close ? weekMinute(period.close) : null;
    if (inPeriod(now, open, close)) return period;
  }
  return null;
}

function nextOpen(now: number, nowDay: number, periods: HoursPeriod[]): string | null {
  let best: { delta: number; point: HoursPoint } | null = null;
  for (const period of periods) {
    const open = weekMinute(period.open);
    let delta = (open - now + WEEK_MINUTES) % WEEK_MINUTES;
    if (delta === 0) delta = WEEK_MINUTES;
    if (!best || delta < best.delta) best = { delta, point: period.open };
  }
  if (!best) return null;
  const clock = formatClock(best.point.hour, best.point.minute);
  if (best.point.day === nowDay) return clock;
  return `${DAY_NAMES[best.point.day]} ${clock}`;
}

export function hoursStatus(
  hours: LeadHours | null | undefined,
  businessStatus?: string | null,
  at: Date = new Date(),
): HoursStatus | null {
  const status = (businessStatus || "").toUpperCase();
  if (status === "CLOSED_PERMANENTLY") {
    return { kind: "perm_closed", label: "Closed", title: "Permanently closed" };
  }
  if (status === "CLOSED_TEMPORARILY") {
    return {
      kind: "temp_closed",
      label: "Temp. closed",
      title: "Temporarily closed",
    };
  }
  if (!hours?.timezone || !hours.periods?.length) return null;

  const local = localNow(hours.timezone, at);
  if (!local) return null;
  const now = weekMinute(local);
  const weekly = hours.weekday_text?.filter(Boolean).join("\n") || "";
  const openPeriod = currentPeriod(now, hours.periods);

  if (openPeriod && !openPeriod.close) {
    return {
      kind: "open",
      label: "Open",
      title: weekly || "Open 24 hours",
    };
  }
  if (openPeriod?.close) {
    const until = formatClock(openPeriod.close.hour, openPeriod.close.minute);
    return {
      kind: "open",
      label: "Open",
      title: weekly ? `Closes ${until}\n${weekly}` : `Closes ${until}`,
    };
  }

  const opens = nextOpen(now, local.day, hours.periods);
  return {
    kind: "closed",
    label: "Closed",
    title: weekly
      ? `${opens ? `Opens ${opens}\n` : ""}${weekly}`
      : opens
        ? `Opens ${opens}`
        : "Closed",
  };
}
