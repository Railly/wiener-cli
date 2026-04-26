// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import type { Envelope } from "./envelope.ts";

export function emit(envelope: Envelope): void {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}

export function emitError(envelope: Envelope): void {
  process.stderr.write(JSON.stringify(envelope) + "\n");
}
