import type { Command } from "commander";
import { IntranetClient } from "../../lib/api/intranet/client.js";
import {
  loadIntranetSession,
  wipeCanvasSession,
  wipeIntranetSession,
} from "../../lib/auth/store.js";
import { ok } from "../../lib/output/envelope.js";
import { printSuccess } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";

interface LogoutOptions {
  json?: boolean;
  profile?: string;
  canvas?: boolean;
  all?: boolean;
}

export function registerAuthLogout(authCmd: Command): void {
  authCmd
    .command("logout")
    .description("Log out of intranet (optionally Canvas with --canvas or --all)")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--canvas", "Also wipe Canvas PAT")
    .option("--all", "Wipe both intranet and Canvas")
    .action(async (opts: LogoutOptions) => {
      const profile = opts.profile ?? "default";
      const start = Date.now();
      const wipeCanvas = opts.canvas === true || opts.all === true;

      const session = await loadIntranetSession(profile);
      if (session) {
        try {
          const client = new IntranetClient({
            aspCookieName: session.aspCookieName,
            aspCookieValue: session.aspCookieValue,
          });
          await client.fetch("/CerrarSesion.asp?p=alu");
        } catch {
          // Best-effort logout
        }
        await wipeIntranetSession(profile);
      }

      if (wipeCanvas) {
        await wipeCanvasSession(profile);
      }

      const data = { ok: true };
      if (opts.json) {
        emitJson(ok(data, { duration_ms: Date.now() - start }));
      }

      printSuccess("Sesión cerrada");
      if (wipeCanvas) printSuccess("Canvas PAT eliminado");
      process.exit(0);
    });
}
