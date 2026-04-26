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

export function relativeDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);
  const diffMo = Math.floor(diffDay / 30);

  if (diffSec < 60) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}min`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDay === 1) return "ayer";
  if (diffDay < 7) return `hace ${diffDay}d`;
  if (diffWk < 5) return `hace ${diffWk}sem`;
  if (diffMo < 12) return `hace ${diffMo}mes`;
  return `hace ${Math.floor(diffMo / 12)}año`;
}
