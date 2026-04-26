// PHASE A WILL REPLACE — stub for Phase D
import type { Envelope } from "./envelope.js";

export function emit<T>(envelope: Envelope<T>): void {
  process.stdout.write(JSON.stringify(envelope) + "\n");
}
