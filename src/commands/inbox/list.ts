// wiener inbox [--no-leidos]

import pc from "picocolors";
import { fetchConversations } from "../../lib/api/canvas/conversations.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { formatDueDate } from "../../lib/format/date.js";
import { emit } from "../../lib/output/json.js";

export async function runInbox(opts: {
  json?: boolean;
  noLeidos?: boolean;
}): Promise<void> {
  try {
    const conversations = await fetchConversations({ unreadOnly: opts.noLeidos });

    const conversaciones = conversations.map((c) => ({
      id: c.id,
      from: c.participants?.[0]?.name ?? "—",
      subject: c.subject ?? "(sin asunto)",
      last_message_at: c.last_message_at ?? null,
      unread: c.workflow_state === "unread",
      count: c.message_count,
      context: c.context_name ?? null,
    }));

    const data = { conversaciones };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (conversaciones.length === 0) {
      console.log(pc.green(opts.noLeidos ? "No hay mensajes no leídos." : "No hay mensajes."));
      return;
    }

    console.log(
      renderSection(
        "Inbox",
        renderTable(conversaciones, [
          {
            header: "De",
            get: (c) => c.from,
            weight: 1,
            min: 12,
            max: 25,
            show: "always",
            priority: 9,
          },
          {
            header: "Asunto",
            get: (c) => c.subject,
            weight: 3,
            min: 20,
            show: "always",
            priority: 10,
          },
          {
            header: "Último",
            get: (c) => formatDueDate(c.last_message_at),
            weight: 1,
            min: 14,
            show: "wide",
            priority: 6,
          },
          {
            header: "Msgs",
            get: (c) => String(c.count),
            fixed: 5,
            align: "right",
            show: "wide",
            priority: 4,
          },
          {
            header: "Leído",
            get: (c) => (c.unread ? "NO" : "sí"),
            fixed: 6,
            color: (v) => (v === "NO" ? pc.yellow(v) : pc.dim(v)),
            show: "always",
            priority: 8,
          },
        ]),
      ),
    );
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
