import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePagos } from "../../src/lib/parsers/pagos-table.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parsePagos", () => {
  test("parses correct number of items", () => {
    const html = fixture("pagos.html");
    const data = parsePagos(html);
    expect(data.items.length).toBe(2);
  });

  test("parses monto stripping S/. prefix", () => {
    const html = fixture("pagos.html");
    const { items } = parsePagos(html);
    const pension = items.find((i) => i.concepto.includes("PENSIÓN"));
    expect(pension).toBeDefined();
    expect(pension?.monto).toBe(450.0);
    expect(typeof pension?.monto).toBe("number");
  });

  test("converts vencimiento to ISO 8601", () => {
    const html = fixture("pagos.html");
    const { items } = parsePagos(html);
    const pension = items.find((i) => i.concepto.includes("PENSIÓN"));
    expect(pension?.vencimiento).toBe("2026-05-10");
  });

  test("calculates total_pendiente", () => {
    const html = fixture("pagos.html");
    const data = parsePagos(html);
    expect(data.total_pendiente).toBe(600.0);
  });

  test("parses estado correctly", () => {
    const html = fixture("pagos.html");
    const { items } = parsePagos(html);
    const vencido = items.find((i) => i.concepto.includes("MATRÍCULA"));
    expect(vencido?.estado).toBe("VENCIDO");
  });

  test("empty page returns zero total and empty items", () => {
    const data = parsePagos("<html><body></body></html>");
    expect(data.items).toEqual([]);
    expect(data.total_pendiente).toBe(0);
  });
});
