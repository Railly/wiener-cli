import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import type { DeltaItem } from "../state/diff.js";

function getWebhookUrl(): string | null {
  if (process.env.WIENER_WATCH_WHATSAPP_URL) {
    return process.env.WIENER_WATCH_WHATSAPP_URL;
  }
  const secretPath = join(homedir(), ".kai", "webhook-secret");
  if (existsSync(secretPath)) {
    const secret = readFileSync(secretPath, "utf-8").trim();
    if (secret) return "https://kai.railly.dev/webhook";
  }
  return null;
}

export async function notifyWhatsApp(items: DeltaItem[]): Promise<void> {
  if (items.length === 0) return;
  const url = getWebhookUrl();
  if (!url) return;

  const lines = items.map((it) => `- *${it.titulo}* (${it.curso})`).join("\n");
  const text = `*Wiener*: ${items.length} cambio${items.length > 1 ? "s" : ""}\n${lines}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, source: "wiener-watch" }),
    });
  } catch {
    // non-fatal
  }
}
