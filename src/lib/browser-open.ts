import { $ } from "bun";

export async function openInBrowser(url: string): Promise<void> {
  const platform = process.platform;
  if (platform === "darwin") {
    await $`open ${url}`.quiet();
  } else if (platform === "linux") {
    await $`xdg-open ${url}`.quiet();
  } else {
    throw new Error(`Unsupported platform for browser open: ${platform}`);
  }
}

export const openUrl = openInBrowser;
