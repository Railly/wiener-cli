// PHASE A WILL REPLACE: JSON emitter — Phase A provides the authoritative version

import type { Envelope } from "./envelope.js";

export function emit<T>(envelope: Envelope<T>): void {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}
