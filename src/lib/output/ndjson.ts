import type { Envelope } from "./envelope.js";

export async function emitStream<T>(source: AsyncIterable<T> | Iterable<T>): Promise<void> {
  for await (const item of source) {
    process.stdout.write(JSON.stringify(item) + "\n");
  }
}

export function emitNdjsonLine(envelope: Envelope): void {
  const line = JSON.stringify(envelope);
  if (envelope.ok) {
    process.stdout.write(`${line}\n`);
  } else {
    process.stderr.write(`${line}\n`);
  }
}

export function createNdjsonEmitter() {
  return {
    emit(envelope: Envelope): void {
      emitNdjsonLine(envelope);
    },
    end(): never {
      process.exit(0);
    },
  };
}
