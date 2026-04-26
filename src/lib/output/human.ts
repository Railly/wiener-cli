// PHASE A WILL REPLACE — stub for Phase D
import pc from "picocolors";

export function renderTable(
  headers: string[],
  rows: string[][],
  opts: { color?: boolean } = {}
): string {
  const { color = true } = opts;
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const sep = colWidths.map((w) => "-".repeat(w + 2)).join("+");
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i] ?? 0)).join(" | ");
  const dataRows = rows.map((r) => r.map((c, i) => (c ?? "").padEnd(colWidths[i] ?? 0)).join(" | "));
  const lines = [sep, headerRow, sep, ...dataRows, sep];
  if (!color) return lines.join("\n");
  return lines
    .map((l, idx) => (idx === 1 ? pc.bold(l) : l))
    .join("\n");
}
