import Table from "cli-table3";
import pc from "picocolors";

export interface TableColumn {
  header: string;
  key: string;
  transform?: (val: unknown) => string;
}

export function printTable(rows: Record<string, unknown>[], columns: TableColumn[]): void {
  const table = new Table({
    head: columns.map((c) => pc.bold(c.header)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(
      columns.map((col) => {
        const val = row[col.key];
        if (col.transform) return col.transform(val);
        if (val === null || val === undefined) return pc.dim("-");
        return String(val);
      }),
    );
  }

  console.log(table.toString());
}

export function printKeyValue(pairs: Record<string, unknown>): void {
  const maxKey = Math.max(...Object.keys(pairs).map((k) => k.length));
  for (const [key, val] of Object.entries(pairs)) {
    const paddedKey = key.padEnd(maxKey);
    const display = val === null || val === undefined ? pc.dim("-") : String(val);
    console.log(`  ${pc.bold(paddedKey)}  ${display}`);
  }
}

export function printError(codeOrMessage: string, message?: string, hint?: string): void {
  if (message === undefined) {
    console.error(pc.red(codeOrMessage));
  } else {
    console.error(pc.red(`error [${codeOrMessage}]: ${message}`));
    if (hint) {
      console.error(pc.dim(`  hint: ${hint}`));
    }
  }
}

export function printLine(text: string): void {
  console.log(text);
}

export function printHeader(title: string): void {
  if (title) console.log(pc.bold(title));
}

export function printSuccess(message: string): void {
  console.log(`${pc.green("✓")} ${message}`);
}

export function printWarning(message: string): void {
  console.warn(`${pc.yellow("⚠")} ${message}`);
}

export function printInfo(message: string): void {
  console.log(`${pc.dim("→")} ${message}`);
}

// Phase C extensions: rich table/section rendering for Canvas commands

export interface ColumnDef {
  header: string;
  key: string;
  color?: (val: string) => string;
  maxWidth?: number;
}

export function renderTable(rows: Record<string, unknown>[], columns: ColumnDef[]): string {
  if (rows.length === 0) return pc.dim("(no items)");

  const table = new Table({
    head: columns.map((c) => pc.bold(c.header)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(
      columns.map((c) => {
        const raw = row[c.key] ?? "";
        let val = String(raw);
        if (c.maxWidth && val.length > c.maxWidth) {
          val = `${val.slice(0, c.maxWidth - 1)}…`;
        }
        return c.color ? c.color(val) : val;
      }),
    );
  }

  return table.toString();
}

export function renderKeyValue(data: Record<string, unknown>, indent = 0): string {
  const pad = " ".repeat(indent);
  return Object.entries(data)
    .map(([k, v]) => {
      const key = pc.bold(k);
      if (v === null || v === undefined) return `${pad}${key}: ${pc.dim("—")}`;
      if (typeof v === "object") {
        return `${pad}${key}:\n${renderKeyValue(v as Record<string, unknown>, indent + 2)}`;
      }
      return `${pad}${key}: ${String(v)}`;
    })
    .join("\n");
}

export function renderSection(title: string, content: string): string {
  const line = pc.dim("─".repeat(Math.min(60, title.length + 4)));
  return `\n${pc.bold(title)}\n${line}\n${content}`;
}

export function truncateHtml(html: string, maxLen = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return pc.dim("—");
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return pc.dim("—");
  return d.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
