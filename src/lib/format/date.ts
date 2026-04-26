import pc from "picocolors";

const TIMEZONE = "America/Lima";

function isToday(date: Date, now: Date): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isTomorrow(date: Date, now: Date): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isToday(date, tomorrow);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-PE", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function weekdayShort(date: Date): string {
  return date.toLocaleDateString("es-PE", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
}

function dateMonthShort(date: Date): string {
  return date.toLocaleDateString("es-PE", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
  });
}

export function formatDueDate(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return pc.dim("—");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return pc.dim("—");

  const diffMs = date.getTime() - now.getTime();
  const diffH = diffMs / 3600000;
  const diffDays = Math.floor(Math.abs(diffH) / 24);

  if (diffH < 0) {
    if (Math.abs(diffH) < 24) {
      return pc.red(`vencida hace ${Math.round(Math.abs(diffH))}h`);
    }
    return pc.red(`atrasada ${diffDays}d`);
  }

  if (diffH < 1) {
    return pc.red(`en ${Math.round(diffH * 60)}min`);
  }

  if (diffH < 6) {
    const h = Math.floor(diffH);
    const m = Math.round((diffH - h) * 60);
    return pc.yellow(m > 0 ? `en ${h}h ${m}min` : `en ${h}h`);
  }

  if (isToday(date, now)) {
    return pc.yellow(`hoy ${formatTime(date)}`);
  }

  if (isTomorrow(date, now)) {
    return pc.yellow(`mañana ${formatTime(date)}`);
  }

  if (diffH < 168) {
    return `${weekdayShort(date)} ${formatTime(date)}`;
  }

  return pc.dim(`${dateMonthShort(date)} ${formatTime(date)}`);
}

export function colorDueDate(formatted: string, diffH: number): string {
  if (diffH < 0) return pc.red(formatted);
  if (diffH < 24) return pc.red(formatted);
  if (diffH < 48) return pc.yellow(formatted);
  return formatted;
}

export function dueDateDiffH(iso: string | null | undefined, now = new Date()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (date.getTime() - now.getTime()) / 3600000;
}
