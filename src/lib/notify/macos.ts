import type { DeltaItem } from "../state/diff.js";

export async function notifyMacos(items: DeltaItem[]): Promise<void> {
  if (items.length === 0) return;
  const title = "Wiener";
  const message =
    items.length === 1 ? items[0]?.titulo : `${items.length} cambios — ver wiener nuevo`;

  const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title}"`;
  const proc = Bun.spawn(["osascript", "-e", script], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}
