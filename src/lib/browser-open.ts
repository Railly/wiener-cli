export { openUrl } from "./platform/open-url.js";

import { openUrl } from "./platform/open-url.js";

export async function openInBrowser(url: string): Promise<void> {
  await openUrl(url);
}
