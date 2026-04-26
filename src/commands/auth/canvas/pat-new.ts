import type { Command } from "commander";
import pc from "picocolors";
import { getSelf } from "../../../lib/api/canvas/users.js";
import { auditLog } from "../../../lib/audit/log.js";
import { promptPat } from "../../../lib/auth/prompt.js";
import { saveCanvasSession } from "../../../lib/auth/store.js";
import { openInBrowser } from "../../../lib/browser-open.js";
import type { WienerError } from "../../../lib/errors.js";
import { ok } from "../../../lib/output/envelope.js";
import { err } from "../../../lib/output/envelope.js";
import { printInfo, printSuccess } from "../../../lib/output/human.js";
import { printError } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";

const SETTINGS_URL = "https://campus.uwiener.edu.pe/profile/settings";

interface PatNewOptions {
  json?: boolean;
  profile?: string;
}

export function registerCanvasPatNew(canvasCmd: Command): void {
  canvasCmd
    .command("pat new")
    .description("Open Canvas profile settings to generate a new PAT, then save it")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (opts: PatNewOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";

      try {
        await openInBrowser(SETTINGS_URL);
        printInfo(`Abriendo ${SETTINGS_URL} en tu navegador...`);
        console.log();
        console.log(pc.bold("Pasos:"));
        console.log("  1. Inicia sesión en Canvas si no lo has hecho");
        console.log("  2. Ve a 'Approved Integrations' → '+ New Access Token'");
        console.log("  3. Copia el token generado");
        console.log("  4. Pégalo aquí:");
        console.log();

        const token = await promptPat();
        const user = await getSelf(token);
        await saveCanvasSession(
          {
            token,
            validatedAt: new Date().toISOString(),
            userId: user.id,
            primaryEmail: user.primary_email,
            name: user.name,
          },
          profile,
        );

        auditLog({
          ts: new Date().toISOString(),
          command: "auth canvas pat new",
          trust: "T2",
          profile,
          result: "ok",
          duration_ms: Date.now() - start,
        });

        const data = {
          url_opened: SETTINGS_URL,
          hint: "Token guardado exitosamente",
          user: { id: user.id, name: user.name },
        };
        if (opts.json) {
          emitJson(ok(data, { duration_ms: Date.now() - start }));
        }
        printSuccess(`Canvas PAT configurado para ${user.name}`);
        process.exit(0);
      } catch (e) {
        const wienerErr = e as WienerError;
        const envelope = err(wienerErr.code ?? "unknown-error", wienerErr.message, wienerErr.hint);
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        process.exit(1);
      }
    });
}
