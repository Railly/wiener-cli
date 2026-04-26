// Time utilities with Lima timezone (America/Lima, UTC-5, no DST)

const LIMA_TZ = "America/Lima";

export function nowLima(): Date {
  return new Date();
}

export function todayLima(): { start: Date; end: Date } {
  const now = new Date();
  const limaStr = now.toLocaleDateString("en-CA", { timeZone: LIMA_TZ });
  const [year, month, day] = limaStr.split("-").map(Number);

  if (!year || !month || !day) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const start = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0));
  return { start, end };
}

export function weekFromNowLima(days = 7): { start: Date; end: Date } {
  const { start } = todayLima();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isoDateLima(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: LIMA_TZ });
}

export function isToday(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  const { start, end } = todayLima();
  const d = new Date(isoDate);
  return d >= start && d < end;
}

export function isPast(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  const { start } = todayLima();
  return new Date(isoDate) < start;
}

export function isWithinDays(isoDate: string | null | undefined, days: number): boolean {
  if (!isoDate) return false;
  const { start, end } = weekFromNowLima(days);
  const d = new Date(isoDate);
  return d >= start && d < end;
}
