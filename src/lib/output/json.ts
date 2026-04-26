import type { Envelope } from "./envelope.js";
import { applyFields } from "./fields.js";

export function emitJson(envelope: Envelope, fields?: string[]): never {
  let out: Envelope = envelope;

  if (fields && fields.length > 0 && out.ok && out.data !== null && typeof out.data === "object") {
    out = { ...out, data: applyFields(out.data as Record<string, unknown>, fields) };
  }

  const text = JSON.stringify(out, null, 2);

  if (out.ok) {
    process.stdout.write(`${text}\n`);
    process.exit(0);
  } else {
    process.stderr.write(`${text}\n`);
    process.exit(1);
  }
}
