import { Command } from "commander";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { fetchPagos, fetchPagosHistorial } from "../../lib/api/intranet/pagos.ts";
import { ok, err } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isWienerError } from "../../lib/errors.ts";

export function makePagosCommand(): Command {
  const cmd = new Command("pagos")
    .description("Obligaciones pendientes de pago (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPagos(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log("\nPagos / Obligaciones\n");

        if (data.items.length === 0) {
          console.log("  Sin obligaciones pendientes.");
          return;
        }

        console.log("  Concepto                                         Monto (S/)   Vencimiento  Estado");
        console.log("  " + "─".repeat(90));
        for (const item of data.items) {
          const monto = `S/. ${item.monto.toFixed(2)}`.padStart(12);
          console.log(
            `  ${item.concepto.slice(0, 48).padEnd(48)} ${monto}   ${(item.vencimiento ?? "—").padEnd(12)} ${item.estado}`,
          );
        }
        console.log("  " + "─".repeat(90));
        console.log(`  Total pendiente: S/. ${data.total_pendiente.toFixed(2)}`);
      } catch (e) {
        if (isWienerError(e)) {
          emitError(err(e.code, e.message, e.hint));
          process.exit(1);
        }
        emitError(err("parse-error", String(e)));
        process.exit(1);
      }
    });

  cmd
    .command("historial")
    .description("Historial de pagos realizados (intranet — needs validation)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPagosHistorial(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        if (data.pagos.length === 0) {
          console.log("\nNo se encontraron pagos en el historial.");
          return;
        }

        console.log("\nHistorial de Pagos\n");
        console.log("  Concepto                                         Monto (S/)   Fecha Pago");
        console.log("  " + "─".repeat(75));
        for (const p of data.pagos) {
          const monto = `S/. ${p.monto.toFixed(2)}`.padStart(12);
          console.log(
            `  ${p.concepto.slice(0, 48).padEnd(48)} ${monto}   ${p.fecha_pago ?? "—"}`,
          );
        }
      } catch (e) {
        if (isWienerError(e)) {
          emitError(err(e.code, e.message, e.hint));
          process.exit(1);
        }
        emitError(err("parse-error", String(e)));
        process.exit(1);
      }
    });

  return cmd;
}
