// wiener inbox info <id>

import pc from "picocolors";
import { emitNextSteps } from "../../lib/agent/next-steps.js";
import { fetchConversation } from "../../lib/api/canvas/conversations.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { relativeDate } from "../../lib/time.js";

export async function runInboxInfo(
  id: string,
  opts: { json?: boolean; profile?: string },
): Promise<void> {
  try {
    const convId = Number.parseInt(id, 10);
    if (Number.isNaN(convId)) {
      const e = err("validation-error", "Conversation ID must be a number");
      if (opts.json) {
        emit(e);
        return;
      }
      process.stderr.write("Error: conversation ID must be a number\n");
      process.exit(1);
      return;
    }

    const conv = await fetchConversation(convId, opts.profile);

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

    if (opts.json) {
      emit(ok(data));
      return;
    }

    const subject = conv.subject ?? "(sin asunto)";
    const count = conv.message_count;
    const withLine = `con ${participantes.map((p) => p.name).join(", ")} · ${count} mensaje${count === 1 ? "" : "s"}`;

    console.log();
    console.log(pc.dim(`─ ${pc.bold(subject)}`));
    console.log(`  ${pc.dim(withLine)}`);
    console.log();

    for (const msg of data.mensajes) {
      const when = relativeDate(msg.created_at);
      const authorLabel = pc.bold(pc.cyan(msg.author));
      console.log(`  ${pc.dim("─")} ${authorLabel}    ${pc.dim(when)}`);
      const bodyLines = msg.body.replace(/\r\n/g, "\n").split("\n");
      for (const line of bodyLines) {
        console.log(`    ${pc.dim('"')}${line}`);
      }
      console.log();
    }

    emitNextSteps([
      { command: "wiener inbox", description: "volver a la bandeja" },
      { command: `wiener inbox --no-leidos`, description: "solo no leídos" },
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
