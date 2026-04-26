// wiener inbox [--no-leidos]

import pc from "picocolors";
import { fetchConversations } from "../../lib/api/canvas/conversations.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
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

    const rows = conversaciones.map((c) => ({
      id: String(c.id),
      de: c.from,
      asunto: c.subject,
      ultimo: formatDate(c.last_message_at),
      mensajes: String(c.count),
      leido: c.unread ? pc.yellow("NO") : pc.dim("sí"),
    }));

    console.log(
      renderSection(
        "Inbox",
        renderTable(rows, [
          { header: "ID", key: "id" },
          { header: "De", key: "de", maxWidth: 30 },
          { header: "Asunto", key: "asunto", maxWidth: 40 },
          { header: "Último", key: "ultimo" },
          { header: "Msgs", key: "mensajes" },
          { header: "Leído", key: "leido" },
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
