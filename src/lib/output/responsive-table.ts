import Table from "cli-table3";
import pc from "picocolors";

export type ColumnAlign = "left" | "right" | "center";
export type ColumnTruncate = "end" | "middle" | "start";
export type ColumnShow = "always" | "wide" | "agent-json";

export interface ColumnDef<T> {
  header: string;
  get: (row: T) => string | number;
  align?: ColumnAlign;
  fixed?: number;
  min?: number;
  max?: number;
  weight?: number;
  truncate?: ColumnTruncate;
  show?: ColumnShow;
  priority?: number;
  color?: (val: string, row: T) => string;
}

export interface RenderTableOpts {
  width?: number;
}

function terminalWidth(): number {
  if (process.stdout.columns && process.stdout.columns > 0) return process.stdout.columns;
  const envCols = Number.parseInt(process.env.COLUMNS ?? "", 10);
  if (!Number.isNaN(envCols) && envCols > 0) return envCols;
  return 80;
}

function visibleLength(s: string): number {
  return s.replace(/\[[0-9;]*m/g, "").length;
}

function truncateString(s: string, maxLen: number, mode: ColumnTruncate = "end"): string {
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return "…";
  if (mode === "start") return `…${s.slice(s.length - (maxLen - 1))}`;
  if (mode === "middle") {
    const half = Math.floor((maxLen - 1) / 2);
    return `${s.slice(0, half)}…${s.slice(s.length - (maxLen - 1 - half))}`;
  }
  const cut = s.lastIndexOf(" ", maxLen - 1);
  if (cut > maxLen * 0.6) return `${s.slice(0, cut)}…`;
  return `${s.slice(0, maxLen - 1)}…`;
}

function cliTable3Align(align: ColumnAlign): "left" | "right" | "middle" {
  if (align === "center") return "middle";
  return align;
}

export function renderTable<T>(rows: T[], columns: ColumnDef<T>[], opts?: RenderTableOpts): string {
  if (rows.length === 0) return pc.dim("(no items)");

  const totalWidth = opts?.width ?? terminalWidth();

  const visibleCols = columns.filter((c) => c.show !== "agent-json");

  let activeCols = visibleCols.slice();

  const CELL_PADDING = 2;
  const OUTER_BORDER = 1;

  function colWidthFromContent(contentW: number): number {
    return contentW + CELL_PADDING;
  }

  const fixedWidth = (col: ColumnDef<T>) => colWidthFromContent(col.fixed ?? 0);
  const isFixed = (col: ColumnDef<T>) => col.fixed !== undefined;
  const isFlexCol = (col: ColumnDef<T>) => !isFixed(col);

  function totalFixedWidth(cols: ColumnDef<T>[]): number {
    return cols.filter(isFixed).reduce((sum, c) => sum + fixedWidth(c), 0);
  }

  function totalFlexMinWidth(cols: ColumnDef<T>[]): number {
    return cols
      .filter(isFlexCol)
      .reduce(
        (sum, c) => sum + colWidthFromContent(c.min ?? Math.max(visibleLength(c.header), 4)),
        0,
      );
  }

  function overhead(cols: ColumnDef<T>[]): number {
    return OUTER_BORDER;
  }

  while (activeCols.length > 1) {
    const needed =
      totalFixedWidth(activeCols) + totalFlexMinWidth(activeCols) + overhead(activeCols);
    if (needed <= totalWidth) break;

    const droppable = activeCols
      .filter((c) => c.show !== "always")
      .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

    if (droppable.length === 0) break;
    const victim = droppable[0];
    if (victim === undefined) break;
    activeCols = activeCols.filter((c) => c !== victim);
  }

  const fixedTotal = totalFixedWidth(activeCols);
  const overheadTotal = overhead(activeCols);
  const flexMinTotal = totalFlexMinWidth(activeCols);
  const remaining = Math.max(flexMinTotal, totalWidth - fixedTotal - overheadTotal);

  const flexCols = activeCols.filter(isFlexCol);
  const totalWeight = flexCols.reduce((s, c) => s + (c.weight ?? 1), 0);

  const colWidths = activeCols.map((col) => {
    if (isFixed(col)) return fixedWidth(col);

    const minContent = col.min ?? Math.max(visibleLength(col.header), 4);
    const maxContent = col.max ?? Number.POSITIVE_INFINITY;
    const weight = col.weight ?? 1;
    const shareContent =
      totalWeight > 0 ? Math.floor((remaining * weight) / totalWeight) : minContent;
    const contentW = Math.max(minContent, Math.min(maxContent, shareContent));
    return colWidthFromContent(contentW);
  });

  const table = new Table({
    head: activeCols.map((c) => pc.bold(c.header)),
    style: { head: [], border: [] },
    colWidths,
    wordWrap: true,
    colAligns: activeCols.map((c) => cliTable3Align(c.align ?? "left")),
  });

  const PADDING = 2;
  for (const row of rows) {
    table.push(
      activeCols.map((col, i) => {
        const raw = String(col.get(row) ?? "");
        const colW = colWidths[i] ?? 20;
        const contentW = Math.max(1, colW - PADDING);

        let val = raw;
        const visLen = visibleLength(val);
        if (visLen > contentW) {
          val = truncateString(val, contentW, col.truncate ?? "end");
        }

        return col.color ? col.color(val, row) : val;
      }),
    );
  }

  return table.toString();
}
