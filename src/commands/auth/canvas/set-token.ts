import type { Command } from "commander";
import { getSelf } from "../../../lib/api/canvas/users.js";
import { auditLog } from "../../../lib/audit/log.js";
import { promptPat } from "../../../lib/auth/prompt.js";
import { saveCanvasSession } from "../../../lib/auth/store.js";
import { getEnv } from "../../../lib/env.js";
import type { WienerError } from "../../../lib/errors.js";
import { err, ok } from "../../../lib/output/envelope.js";
import { printError, printSuccess } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";
import { shouldPrompt } from "../../../lib/tty.js";

interface SetTokenOptions {
  json?: boolean;
  noInput?: boolean;
  profile?: string;
}

export function registerCanvasSetToken(canvasCmd: Command): void {
  canvasCmd
    .command("set-token [pat]")
    .description("Set Canvas Personal Access Token and validate it")
    .option("--json", "Output JSON envelope")
    .option("--no-input", "Non-interactive mode (use WIENER_CANVAS_TOKEN env var)")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (patArg: string | undefined, opts: SetTokenOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";
      const env = getEnv();

      let token = patArg ?? env.WIENER_CANVAS_TOKEN;

      if (!token) {
        if (!shouldPrompt(opts.noInput)) {
          const envelope = err(
            "validation-error",
            "Canvas token required but --no-input is set",
            "Set WIENER_CANVAS_TOKEN environment variable",
          );
          if (opts.json) emitJson(envelope);
          printError(envelope.error.code, envelope.error.message, envelope.error.hint);
          process.exit(2);
        }
        token = await promptPat();
      }

      try {
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
          command: "auth canvas set-token",
          trust: "T2",
          profile,
          result: "ok",
          duration_ms: Date.now() - start,
        });

        const data = { ok: true, user: { id: user.id, name: user.name } };
        if (opts.json) {
          emitJson(ok(data, { duration_ms: Date.now() - start }));
        }
        printSuccess(`Canvas token configurado para ${user.name} (ID: ${user.id})`);
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
