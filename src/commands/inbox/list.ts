// wiener inbox [--no-leidos] [--limit N]

import pc from "picocolors";
import { fetchConversations } from "../../lib/api/canvas/conversations.js";
import { emitNextSteps } from "../../lib/agent/next-steps.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { relativeDate } from "../../lib/time.js";

function formatSender(name: string): string {
  const parts = name.split(",");
  if (parts.length >= 2) {
    const last = (parts[0] ?? "").trim().toUpperCase();
    const first = (parts[1] ?? "").trim().split(" ")[0] ?? "";
    return `${last}, ${first}`;
  }
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

function pad(s: string, width: number): string {
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  const diff = width - visible.length;
  return diff > 0 ? `${s}${" ".repeat(diff)}` : s;
}

export async function runInbox(opts: {
  json?: boolean;
  noLeidos?: boolean;
  limit?: number;
  profile?: string;
}): Promise<void> {
  try {
    const all = await fetchConversations({ unreadOnly: opts.noLeidos, profile: opts.profile });
    const limit = opts.limit ?? 20;
    const conversations = all.slice(0, limit);

    const unreadCount = all.filter((c) => c.workflow_state === "unread").length;

    const conversaciones = conversations.map((c) => ({
      id: c.id,
      from: c.participants?.[1]?.name ?? c.participants?.[0]?.name ?? "—",
      subject: c.subject ?? "(sin asunto)",
      last_message_at: c.last_message_at ?? null,
      unread: c.workflow_state === "unread",
      count: c.message_count,
      context: c.context_name ?? null,
    }));

    const data = { total: all.length, unread: unreadCount, conversaciones };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    const label = opts.noLeidos ? "sin leer" : "mensajes";
    const total = opts.noLeidos ? unreadCount : all.length;
    const unreadNote = opts.noLeidos ? "" : pc.dim(` (${unreadCount} sin leer)`);

    console.log(`\n${pc.bold("Bandeja de entrada")} — ${total} ${label}${unreadNote}`);
    console.log(pc.dim("─".repeat(60)));
    console.log();

    if (conversaciones.length === 0) {
      console.log(pc.dim(opts.noLeidos ? "  No hay mensajes sin leer." : "  No hay mensajes."));
    } else {
      for (const c of conversaciones) {
        const dot = c.unread ? pc.cyan("  ●") : "   ";
        const subject = c.unread ? pc.bold(c.subject) : pc.dim(c.subject);
        const from = pc.dim(formatSender(c.from));
        const date = pc.dim(relativeDate(c.last_message_at));

        const subjectPad = pad(subject, 42);
        const fromPad = pad(from, 22);
        console.log(`${dot}  ${subjectPad}  ${fromPad}  ${date}`);
      }
    }

    emitNextSteps([
      { command: "wiener inbox info <id>", description: "leer un mensaje completo" },
      ...(opts.noLeidos
        ? []
        : [{ command: "wiener inbox --no-leidos", description: "solo no leídos" }]),
    ]);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
