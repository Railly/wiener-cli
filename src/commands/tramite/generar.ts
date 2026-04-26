import pc from "picocolors";
import { AUTH_NEXT_STEPS, emitNextSteps } from "../../lib/agent/next-steps.ts";
import {
  fetchTramitePreview,
  fetchTramiteTipos,
  submitTramiteGenerar,
} from "../../lib/api/intranet/tramite.ts";
import { auditLog } from "../../lib/audit/log.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerLike } from "../../lib/errors.ts";
import { beginAudit } from "../../lib/foundation/audit-lifecycle.ts";
import { getWienerPaths } from "../../lib/foundation/xdg-paths.ts";
import { errorEnvelope, successEnvelope } from "../../lib/output/envelope.ts";
import { printError, printHeader, printLine } from "../../lib/output/human.ts";
import { printJson } from "../../lib/output/json.ts";
import { confirmT2 } from "../../lib/safety/confirm.ts";
import { checkRateGuard, markRateGuardUsed } from "../../lib/safety/rate-guard.ts";

export interface TramiteGenerarOptions {
  tipo: string;
  yes: boolean;
  dryRun: boolean;
  json: boolean;
  noInput: boolean;
  profile: string;
}

const RATE_LIMIT_WINDOW_MS = 60_000;

function buildPreviewText(preview: {
  tipoLabel: string;
  concepto: string;
  monto: string;
  vencimiento: string;
}): string {
  const hr = "─".repeat(40);
  return [
    pc.bold("wiener tramite generar — PREVIEW"),
    hr,
    `Tipo:        ${preview.tipoLabel}`,
    `Concepto:    ${preview.concepto}`,
    `Monto:       ${pc.yellow(preview.monto)}`,
    `Vencimiento: ${preview.vencimiento}`,
    "",
    pc.dim("Esto generará una orden de pago real en el sistema Wiener."),
    pc.dim("Continúa con --yes o cancela con Ctrl+C."),
  ].join("\n");
}

export async function runTramiteGenerar(opts: TramiteGenerarOptions): Promise<void> {
  const startMs = Date.now();
  const txId = `tx_${Date.now()}`;
  const auditDir = getWienerPaths().audit;

  const session = await loadIntranetSession(opts.profile);
  if (!session) {
    const err = errorEnvelope(
      "auth-required",
      "No intranet session. Run `wiener auth login` first.",
      "wiener auth login",
    );
    if (opts.json) {
      printJson(err);
    } else {
      printError(err.error.message);
      emitNextSteps([AUTH_NEXT_STEPS.intranet], { json: opts.json });
    }
    process.exit(1);
  }

  if (!opts.dryRun) {
    try {
      checkRateGuard("tramite-generar", RATE_LIMIT_WINDOW_MS, opts.profile);
    } catch (e) {
      if (isWienerLike(e)) {
        const err = errorEnvelope(e.code, e.message, e.hint);
        if (opts.json) {
          printJson(err);
        } else {
          printError(`[${e.code}] ${e.message}`);
          if (e.hint) printLine(pc.dim(`Hint: ${e.hint}`));
        }
        process.exit(1);
        return;
      }
      throw e;
    }
  }

  try {
    const tipos = await fetchTramiteTipos(session);

    if (tipos.length > 0) {
      const match = tipos.find(
        (t) =>
          t.value.toLowerCase() === opts.tipo.toLowerCase() ||
          t.label.toLowerCase().includes(opts.tipo.toLowerCase()),
      );
      if (!match) {
        const validList = tipos.map((t) => `  ${t.value} — ${t.label}`).join("\n");
        const err = errorEnvelope(
          "validation-error",
          `Unknown --tipo "${opts.tipo}". Valid tipos:`,
          undefined,
          { valid_tipos: tipos, user_input: opts.tipo },
        );
        if (opts.json) {
          printJson(err);
        } else {
          printError(`[validation-error] Unknown --tipo "${opts.tipo}".`);
          printLine(`Valid tipos:\n${validList}`);
        }
        process.exit(1);
        return;
      }
    }

    const preview = await fetchTramitePreview(opts.tipo, session);

    const previewText = buildPreviewText(preview);

    if (!opts.json) {
      printHeader("");
    }

    const decision = await confirmT2("tramite generar", previewText, {
      yes: opts.yes,
      dryRun: opts.dryRun,
      noInput: opts.noInput,
    });

    if (decision === "dry-run") {
      const data = { dryRun: true, ...preview };
      if (opts.json) {
        printJson(successEnvelope(data, { duration_ms: Date.now() - startMs, from_cache: false }));
      } else {
        printLine(previewText);
        printLine(pc.dim("\n[dry-run] No action taken."));
      }
      return;
    }

    if (decision === "aborted") {
      const err = errorEnvelope("validation-error", "Cancelled by user.");
      if (opts.json) {
        printJson(err);
      } else {
        printLine(pc.dim("Cancelled."));
      }
      process.exit(0);
      return;
    }

    const lifecycle = beginAudit(auditDir, {
      kind: "tramite.generar",
      command: "tramite generar",
      tier: "T2",
      profile: opts.profile,
      meta: { tipo: opts.tipo, tx_id: txId },
    });

    const result = await submitTramiteGenerar(opts.tipo, session);

    markRateGuardUsed("tramite-generar", opts.profile);

    const durationMs = Date.now() - startMs;

    lifecycle.complete({ orden_id: result.orden_id });

    if (opts.json) {
      printJson(successEnvelope(result, { duration_ms: durationMs, from_cache: false }));
    } else {
      printLine(pc.green(`\n✓ Orden de pago generada: ${pc.bold(result.orden_id)}`));
      printLine(`  Monto:       ${pc.yellow(result.monto)}`);
      printLine(`  Concepto:    ${result.concepto}`);
      printLine(`  Vencimiento: ${result.vencimiento}`);
    }
  } catch (e) {
    if (isWienerLike(e)) {
      auditLog({
        ts: new Date().toISOString(),
        command: "tramite generar",
        trust: "T2",
        profile: opts.profile,
        args: { tipo: opts.tipo },
        result: "error",
        error_code: e.code,
      });

      const err = errorEnvelope(e.code, e.message, e.hint);
      if (opts.json) {
        printJson(err);
      } else {
        printError(`[${e.code}] ${e.message}`);
        if (e.hint) printLine(pc.dim(`Hint: ${e.hint}`));
      }
      process.exit(1);
      return;
    }
    throw e;
  }
}
