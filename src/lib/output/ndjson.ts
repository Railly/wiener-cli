// PHASE A WILL REPLACE: NDJSON streaming emitter — Phase A provides the authoritative version

export async function emitStream<T>(
  source: AsyncIterable<T> | Iterable<T>
): Promise<void> {
  for await (const item of source) {
    process.stdout.write(JSON.stringify(item) + "\n");
  }
}
