import type { Command } from "commander";
import pc from "picocolors";
import { getSelf } from "../../lib/api/canvas/users.js";
import { loadCanvasSession, loadIntranetSession } from "../../lib/auth/store.js";
import { ok } from "../../lib/output/envelope.js";
import { printKeyValue } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";

interface StatusOptions {
  json?: boolean;
  profile?: string;
  check?: boolean;
}

export function registerAuthStatus(authCmd: Command): void {
  authCmd
    .command("status")
    .description("Show authentication status for both backends")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--check", "Validate Canvas token with a live API call")
    .action(async (opts: StatusOptions) => {
      const profile = opts.profile ?? "default";
      const start = Date.now();

      const [intranetSession, canvasSession] = await Promise.all([
        loadIntranetSession(profile),
        loadCanvasSession(profile),
      ]);

      const intranetStatus = intranetSession
        ? {
            authed: true,
            codigo: intranetSession.codigo,
            perfil: intranetSession.perfil,
            sessionAgeMinutes: Math.round(
              (Date.now() - new Date(intranetSession.capturedAt).getTime()) / 60000,
            ),
          }
        : { authed: false };

      let canvasStatus: Record<string, unknown> = canvasSession
        ? {
            authed: true,
            tokenSet: true,
            userId: canvasSession.userId,
            primaryEmail: canvasSession.primaryEmail,
            lastCallAt: canvasSession.validatedAt,
          }
        : { authed: false, tokenSet: false };

      if (opts.check && canvasSession) {
        try {
          const user = await getSelf(canvasSession.token);
          canvasStatus = {
            ...canvasStatus,
            authed: true,
            userId: user.id,
            name: user.name,
          };
        } catch {
          canvasStatus = { ...canvasStatus, authed: false, checkFailed: true };
        }
      }

      const data = { intranet: intranetStatus, canvas: canvasStatus };

      if (opts.json) {
        emitJson(ok(data, { duration_ms: Date.now() - start }));
      }

      console.log(pc.bold("Intranet"));
      printKeyValue(intranetStatus as Record<string, unknown>);
      console.log();
      console.log(pc.bold("Canvas"));
      printKeyValue(canvasStatus);
      process.exit(0);
    });
}
