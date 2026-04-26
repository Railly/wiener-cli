// wiener inbox info <id>

import { fetchConversation } from "../../lib/api/canvas/conversations.js";
import { ok, err } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { renderSection, formatDate } from "../../lib/output/human.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import pc from "picocolors";

export async function runInboxInfo(
  id: string,
  opts: { json?: boolean }
): Promise<void> {
  try {
    const convId = parseInt(id, 10);
    if (Number.isNaN(convId)) {
      const e = err("validation-error", "Conversation ID must be a number");
      if (opts.json) { emit(e); return; }
      process.stderr.write("Error: conversation ID must be a number\n");
      process.exit(1);
      return;
    }

    const conv = await fetchConversation(convId);

    const mensajes = (conv.messages ?? []).map((m) => ({
      id: m.id,
      author_id: m.author_id,
      created_at: m.created_at,
      body: m.body,
    }));

    const participantes = (conv.participants ?? []).map((p) => ({ id: p.id, name: p.name }));
    const participantMap = new Map(participantes.map((p) => [p.id, p.name]));

    const data = {
      conversacion: {
        id: conv.id,
        subject: conv.subject ?? "(sin asunto)",
        participants: participantes,
        message_count: conv.message_count,
        state: conv.workflow_state,
      },
      mensajes: mensajes.map((m) => ({
        ...m,
        author: participantMap.get(m.author_id) ?? `User ${m.author_id}`,
      })),
    };

    if (opts.json) { emit(ok(data)); return; }

    console.log(pc.bold(`\nConversación #${conv.id} — ${conv.subject ?? "(sin asunto)"}`));
    console.log(pc.dim(`Participantes: ${participantes.map((p) => p.name).join(", ")}`));
    console.log(pc.dim(`Mensajes: ${conv.message_count}\n`));

    for (const msg of data.mensajes) {
      const author = pc.bold(pc.cyan(msg.author));
      const date = pc.dim(formatDate(msg.created_at));
      console.log(`${author}  ${date}`);
      console.log(msg.body);
      console.log();
    }
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
