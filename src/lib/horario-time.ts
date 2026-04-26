import type { DiaCode, HorarioBloque } from "../types/intranet.ts";

const LIMA_TZ = "America/Lima";

const _DAY_NUMBER_TO_CODE: Record<number, DiaCode> = {
  0: "D",
  1: "L",
  2: "M",
  3: "X",
  4: "J",
  5: "V",
  6: "S",
};

export function getNowLima(): Date {
  // Create a date object that represents Lima time
  const now = new Date();
  // Use Intl.DateTimeFormat to get Lima time parts
  return now;
}

export function getLimaDayCode(): DiaCode {
  const now = new Date();
  const limaDateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TZ,
    weekday: "short",
  }).format(now);

  const map: Record<string, DiaCode> = {
    Sun: "D",
    Mon: "L",
    Tue: "M",
    Wed: "X",
    Thu: "J",
    Fri: "V",
    Sat: "S",
  };

  return map[limaDateStr] ?? "L";
}

export function getLimaDateISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getLimaTimeMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === "hour") hours = Number.parseInt(part.value, 10);
    if (part.type === "minute") minutes = Number.parseInt(part.value, 10);
  }

  return hours * 60 + minutes;
}

function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = Number.parseInt(parts[0] ?? "0", 10);
  const m = Number.parseInt(parts[1] ?? "0", 10);
  return h * 60 + m;
}

export function bloqueContainsNow(bloque: HorarioBloque, nowMinutes: number): boolean {
  const start = timeToMinutes(bloque.time_start);
  const end = timeToMinutes(bloque.time_end);
  return nowMinutes >= start && nowMinutes <= end;
}

export function minutesUntilBloque(bloque: HorarioBloque, nowMinutes: number): number {
  const start = timeToMinutes(bloque.time_start);
  return start - nowMinutes;
}

export function sortBloquesByTime(bloques: HorarioBloque[]): HorarioBloque[] {
  return [...bloques].sort((a, b) => timeToMinutes(a.time_start) - timeToMinutes(b.time_start));
}

export function filterBloquesByDayCode(
  dias: Record<DiaCode, HorarioBloque[]>,
  dayCode: DiaCode,
): HorarioBloque[] {
  return sortBloquesByTime(dias[dayCode] ?? []);
}
