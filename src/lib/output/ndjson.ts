// PHASE A WILL REPLACE — stub for Phase D
export async function emitStream<T>(iter: AsyncIterable<T>): Promise<void> {
  for await (const item of iter) {
    process.stdout.write(JSON.stringify(item) + "\n");
  }
}
