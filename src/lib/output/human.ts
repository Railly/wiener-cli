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

export function printError(code: string, message: string, hint?: string): void {
  console.error(pc.red(`error [${code}]: ${message}`));
  if (hint) {
    console.error(pc.dim(`  hint: ${hint}`));
  }
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
