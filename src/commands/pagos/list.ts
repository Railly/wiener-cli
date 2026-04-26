import Table from "cli-table3";
import { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, emitNextSteps } from "../../lib/agent/next-steps.ts";
import { fetchPagos, fetchPagosHistorial } from "../../lib/api/intranet/pagos.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isColorEnabled } from "../../lib/tty.ts";

function colorVencimiento(venc: string | null, color: boolean): string {
  const display = venc ?? "—";
  if (!color || !venc) return display;
  const d = new Date(venc);
  const now = new Date();
  if (d < now) return pc.bold(pc.red(display));
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
  if (diffDays < 3) return pc.yellow(display);
  return display;
}

export function makePagosCommand(): Command {
  const cmd = new Command("pagos")
    .description("Obligaciones pendientes de pago (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPagos(session);
        const color = isColorEnabled();

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log("");
        const hasPending = data.total_pendiente > 0;
        const header = "Pagos / Obligaciones";
        console.log(color ? pc.bold(pc.cyan(header)) : header);
        if (hasPending) {
          const totalStr = `Total pendiente: S/. ${data.total_pendiente.toFixed(2)}`;
          console.log(color ? `  ${pc.bold(pc.red(totalStr))}` : `  ${totalStr}`);
        }
        console.log("");

        if (data.items.length === 0) {
          console.log(
            color ? pc.green("  Sin obligaciones pendientes.") : "  Sin obligaciones pendientes.",
          );
          emitNextSteps(
            NEXT_STEPS.afterPagos as readonly { command: string; description: string }[],
          );
          return;
        }

        const table = new Table({
          head: [
            color ? pc.bold(pc.cyan("Concepto")) : "Concepto",
            color ? pc.bold(pc.cyan("Monto S/.")) : "Monto S/.",
            color ? pc.bold(pc.cyan("Vencimiento")) : "Vencimiento",
            color ? pc.bold(pc.cyan("Estado")) : "Estado",
          ],
          style: { head: [], border: color ? ["dim"] : [] },
          chars: {
            top: "─",
            "top-mid": "┬",
            "top-left": "╭",
            "top-right": "╮",
            bottom: "─",
            "bottom-mid": "┴",
            "bottom-left": "╰",
            "bottom-right": "╯",
            left: "│",
            "left-mid": "├",
            mid: "─",
            "mid-mid": "┼",
            right: "│",
            "right-mid": "┤",
            middle: "│",
          },
        });

        for (const item of data.items) {
          const monto = item.monto.toFixed(2);
          table.push([
            item.concepto.slice(0, 40),
            color ? pc.bold(monto) : monto,
            colorVencimiento(item.vencimiento, color),
            item.estado,
          ]);
        }

        console.log(table.toString());
        emitNextSteps(NEXT_STEPS.afterPagos as readonly { command: string; description: string }[]);
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
        const color = isColorEnabled();

        if (options.json) {
          emit(ok(data));
          return;
        }

        if (data.pagos.length === 0) {
          console.log("\nNo se encontraron pagos en el historial.");
          return;
        }

        console.log("");
        const header = "Historial de Pagos";
        console.log(color ? pc.bold(pc.cyan(header)) : header);

        const table = new Table({
          head: [
            color ? pc.bold(pc.cyan("Concepto")) : "Concepto",
            color ? pc.bold(pc.cyan("Monto S/.")) : "Monto S/.",
            color ? pc.bold(pc.cyan("Fecha pago")) : "Fecha pago",
          ],
          style: { head: [], border: color ? ["dim"] : [] },
          chars: {
            top: "─",
            "top-mid": "┬",
            "top-left": "╭",
            "top-right": "╮",
            bottom: "─",
            "bottom-mid": "┴",
            "bottom-left": "╰",
            "bottom-right": "╯",
            left: "│",
            "left-mid": "├",
            mid: "─",
            "mid-mid": "┼",
            right: "│",
            "right-mid": "┤",
            middle: "│",
          },
        });

        for (const p of data.pagos) {
          table.push([
            p.concepto.slice(0, 40),
            p.monto.toFixed(2),
            color ? pc.dim(p.fecha_pago ?? "—") : (p.fecha_pago ?? "—"),
          ]);
        }

        console.log(table.toString());
        console.log("");
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
