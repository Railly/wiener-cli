import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../env.js";
import { notifyMacos } from "../notify/macos.js";
import { notifyOs } from "../platform/notify-os.js";
import { notifyWhatsApp } from "../notify/whatsapp.js";
import type { DeltaItem } from "../state/diff.js";
import { runNuevo } from "./nuevo-diff.js";

export interface WatchOpts {
  interval?: number;
  notify?: "macos" | "whatsapp" | "both" | "none";
  detach?: boolean;
  dryRun?: boolean;
  profile?: string;
  whatsapp?: boolean;
}

function pidPath(): string {
  return join(homedir(), ".wiener", "watch.pid");
}

function logPath(): string {
  return join(homedir(), ".wiener", "watch.log");
}

function isHoursWindow(hours: string): boolean {
  const [start, end] = hours.split("-");
  if (!start || !end) return true;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = (sh ?? 8) * 60 + (sm ?? 0);
  const endMins = (eh ?? 23) * 60 + (em ?? 0);
  return nowMins >= startMins && nowMins <= endMins;
}

function isSnoozed(snoozeUntil: string | null): boolean {
  if (!snoozeUntil) return false;
  return new Date() < new Date(snoozeUntil);
}

function writePid(): void {
  const dir = join(homedir(), ".wiener");
  mkdirSync(dir, { recursive: true });
  writeFileSync(pidPath(), String(process.pid));
}

function clearPid(): void {
  const path = pidPath();
  if (existsSync(path)) unlinkSync(path);
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stderr.write(line);
  appendFileSync(logPath(), line);
}

async function dispatchNotify(
  items: DeltaItem[],
  method: WatchOpts["notify"],
  whatsapp: boolean,
): Promise<void> {
  if (items.length === 0) return;
  const useWhatsapp = whatsapp || method === "whatsapp" || method === "both";
  const useMacos = !whatsapp && (method === "macos" || method === "both" || !method);
  if (useMacos) {
    const title = "Wiener";
    const message =
      items.length === 1 ? (items[0]?.titulo ?? "") : `${items.length} cambios — ver wiener nuevo`;
    await notifyOs(title, message, { appName: "Wiener" });
  }
  if (useWhatsapp) await notifyWhatsApp(items);
}

async function tick(opts: WatchOpts): Promise<void> {
  const config = loadConfig();

  if (isSnoozed(config.watch.snooze_until)) {
    log("snoozed, skipping tick");
    return;
  }

  if (!isHoursWindow(config.watch.hours ?? "08:00-23:00")) {
    log("outside hours window, skipping tick");
    return;
  }

  const { items } = await runNuevo({ dryRun: opts.dryRun ?? false, profile: opts.profile });
  const ts = new Date().toISOString();

  for (const item of items) {
    process.stdout.write(`${JSON.stringify({ ts, ...item })}\n`);
  }

  if (!opts.dryRun) {
    await dispatchNotify(items, opts.notify, opts.whatsapp ?? false);
  }
  log(`tick done — ${items.length} items`);
}

export async function startWatch(opts: WatchOpts = {}): Promise<void> {
  const config = loadConfig();
  const interval = opts.interval ?? config.watch.interval_ms;
  const pid = pidPath();

  if (existsSync(pid)) {
    const existingPid = readFileSync(pid, "utf-8").trim();
    throw new Error(
      `Watch already running (PID ${existingPid}). Use 'wiener watch stop' to terminate.`,
    );
  }

  if (opts.dryRun) {
    await tick({ ...opts, dryRun: true });
    return;
  }

  writePid();
  process.on("SIGTERM", () => {
    clearPid();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    clearPid();
    process.exit(0);
  });

  log(`watch started (PID ${process.pid}, interval ${interval}ms)`);
  await tick(opts);

  const timer = setInterval(async () => {
    await tick(opts);
  }, interval);

  await new Promise<void>((resolve) => {
    process.once("SIGTERM", resolve);
    process.once("SIGINT", resolve);
  });
  clearInterval(timer);
  clearPid();
}

export function stopWatch(): void {
  const path = pidPath();
  if (!existsSync(path)) {
    throw new Error("No watch process found.");
  }
  const pid = Number(readFileSync(path, "utf-8").trim());
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    throw new Error(`Could not send SIGTERM to PID ${pid}.`);
  }
  unlinkSync(path);
}
