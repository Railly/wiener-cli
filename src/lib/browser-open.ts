export async function openUrl(url: string): Promise<void> {
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  const proc = Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
  await proc.exited;
}
