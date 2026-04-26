import type { Command } from "commander";
import { loginIntranet } from "../../lib/api/intranet/login.js";
import { auditLog } from "../../lib/audit/log.js";
import { promptIntranetCredentials } from "../../lib/auth/prompt.js";
import { loadIntranetSession, saveIntranetSession } from "../../lib/auth/store.js";
import { getEnv } from "../../lib/env.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError, printSuccess } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";
import { shouldPrompt } from "../../lib/tty.js";

interface LoginOptions {
  json?: boolean;
  noInput?: boolean;
  profile?: string;
  verbose?: boolean;
}

export function registerAuthLogin(authCmd: Command): void {
  authCmd
    .command("login")
    .description("Authenticate with the Wiener intranet (interactive)")
    .option("--json", "Output JSON envelope")
    .option("--no-input", "Non-interactive mode (use WIENER_INTRANET_* env vars)")
    .option("--profile <name>", "Profile to use", "default")
    .option("--verbose", "Verbose output")
    .action(async (opts: LoginOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";
      const env = getEnv();

      let usuario: string | undefined = env.WIENER_INTRANET_USER;
      let contrasena: string | undefined = env.WIENER_INTRANET_PASS;
      let perfil: "A" | "D" | "P" = env.WIENER_INTRANET_PERFIL ?? "A";

      if (!usuario || !contrasena) {
        if (!shouldPrompt(opts.noInput)) {
          const envelope = err(
            "validation-error",
            "Credentials required but --no-input is set",
            "Set WIENER_INTRANET_USER and WIENER_INTRANET_PASS environment variables",
          );
          if (opts.json) emitJson(envelope);
          printError(envelope.error.code, envelope.error.message, envelope.error.hint);
          process.exit(2);
        }

        const existing = await loadIntranetSession(profile);
        const creds = await promptIntranetCredentials({
          usuario: existing?.codigo,
          perfil: existing?.perfil,
        });
        usuario = creds.usuario;
        contrasena = creds.contrasena;
        perfil = creds.perfil;
      }

      try {
        const session = await loginIntranet({ usuario, contrasena, perfil });
        await saveIntranetSession(session, profile);

        auditLog({
          ts: new Date().toISOString(),
          command: "auth login",
          trust: "T2",
          profile,
          args: { usuario, perfil },
          result: "ok",
          duration_ms: Date.now() - start,
        });

        const data = { ok: true, perfil: session.perfil, codigo: session.codigo };

        if (opts.json) {
          emitJson(ok(data, { duration_ms: Date.now() - start }));
        }
        printSuccess(`Autenticado como ${session.codigo} (${session.perfil})`);
        process.exit(0);
      } catch (e) {
        const wienerErr = e as WienerError;
        auditLog({
          ts: new Date().toISOString(),
          command: "auth login",
          trust: "T2",
          profile,
          args: { usuario, perfil },
          result: "error",
          error_code: wienerErr.code ?? "unknown-error",
          duration_ms: Date.now() - start,
        });

        const envelope = err(
          wienerErr.code ?? "unknown-error",
          wienerErr.message,
          wienerErr.hint,
          wienerErr.details,
        );
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        process.exit(wienerErr.exitCode ?? 1);
      }
    });
}
