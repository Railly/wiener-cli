import { isColorEnabled } from "../tty.js";
import { VERSION } from "../version.js";

const TEAL = (s: string) => `\x1b[38;2;7;185;189m${s}\x1b[0m`;

const BANNER_LINES = [
  " ██╗    ██╗██╗███████╗███╗   ██╗███████╗██████╗ ",
  " ██║    ██║██║██╔════╝████╗  ██║██╔════╝██╔══██╗",
  " ██║ █╗ ██║██║█████╗  ██╔██╗ ██║█████╗  ██████╔╝",
  " ██║███╗██║██║██╔══╝  ██║╚██╗██║██╔══╝  ██╔══██╗",
  " ╚███╔███╔╝██║███████╗██║ ╚████║███████╗██║  ██║",
  "  ╚══╝╚══╝ ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝",
];

export function renderBanner(opts: { color?: boolean } = {}): string {
  const color = opts.color ?? isColorEnabled();
  const banner = BANNER_LINES.join("\n");
  const subtitle = `  agent-first CLI for UNW students · v${VERSION}`;

  if (!color) {
    return `\n${banner}\n${subtitle}\n`;
  }

  return `\n${TEAL(banner)}\n\x1b[2m${subtitle}\x1b[0m\n`;
}

export function shouldShowBanner(opts: {
  json?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}): boolean {
  if (opts.json) return false;
  if (opts.quiet) return false;
  if (opts.noColor) return false;
  return true;
}
