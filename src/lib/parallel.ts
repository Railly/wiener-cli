// Parallel fetch with concurrency cap

export async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const myIdx = idx++;
      const item = items[myIdx];
      if (item === undefined) continue;
      results[myIdx] = await fn(item);
    }
  }

  const workers: Promise<void>[] = [];
  const limit = Math.min(concurrency, items.length);
  for (let i = 0; i < limit; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}
