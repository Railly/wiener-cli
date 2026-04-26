import { describe, expect, test } from "bun:test";
import pc from "picocolors";
import { renderTable } from "../../src/lib/output/responsive-table.js";

interface Row {
  name: string;
  status: string;
  score: number;
  notes: string;
  extra: string;
}

const sampleRows: Row[] = [
  { name: "Matemáticas I", status: "pendiente", score: 0, notes: "Entrega semana 5", extra: "X" },
  { name: "Química Orgánica", status: "entregado", score: 15, notes: "Calificado", extra: "Y" },
];

const columns = [
  {
    header: "Nombre",
    get: (r: Row) => r.name,
    weight: 3,
    min: 10,
    show: "always" as const,
    priority: 9,
  },
  {
    header: "Estado",
    get: (r: Row) => r.status,
    fixed: 10,
    show: "always" as const,
    priority: 8,
  },
  {
    header: "Nota",
    get: (r: Row) => String(r.score),
    fixed: 5,
    align: "right" as const,
    show: "wide" as const,
    priority: 5,
  },
  {
    header: "Notas",
    get: (r: Row) => r.notes,
    weight: 1,
    min: 8,
    show: "wide" as const,
    priority: 4,
  },
  {
    header: "Extra",
    get: (r: Row) => r.extra,
    fixed: 5,
    show: "wide" as const,
    priority: 1,
  },
];

describe("renderTable", () => {
  test("returns (no items) for empty rows", () => {
    const result = renderTable([], columns, { width: 120 });
    expect(result).toContain("no items");
  });

  test("80-col: highest-priority columns always shown", () => {
    const result = renderTable(sampleRows, columns, { width: 80 });
    expect(result).toContain("Nombre");
    expect(result).toContain("Estado");
    expect(result).toContain("Matemáticas");
    expect(result).toContain("pendiente");
  });

  test("200-col: all columns shown including low-priority", () => {
    const result = renderTable(sampleRows, columns, { width: 200 });
    expect(result).toContain("Nombre");
    expect(result).toContain("Estado");
    expect(result).toContain("Nota");
    expect(result).toContain("Notas");
    expect(result).toContain("Matemáticas I");
    expect(result).toContain("Química Orgánica");
  });

  test("narrow terminal: lowest-priority columns dropped when needed", () => {
    const narrowCols = [
      {
        header: "Nombre",
        get: (r: Row) => r.name,
        weight: 1,
        min: 10,
        show: "always" as const,
        priority: 9,
      },
      {
        header: "Estado",
        get: (r: Row) => r.status,
        fixed: 9,
        show: "always" as const,
        priority: 8,
      },
      {
        header: "Extra",
        get: (r: Row) => r.extra,
        fixed: 20,
        show: "wide" as const,
        priority: 1,
      },
    ];
    const result = renderTable(sampleRows, narrowCols, { width: 40 });
    expect(result).toBeTruthy();
    expect(result).toContain("Nombre");
    expect(result).toContain("Estado");
    expect(result).not.toContain("Extra");
  });

  test("very narrow terminal: only highest-priority columns survive", () => {
    const narrowCols = [
      {
        header: "Nombre",
        get: (r: Row) => r.name,
        weight: 1,
        min: 10,
        show: "always" as const,
        priority: 9,
      },
      {
        header: "Estado",
        get: (r: Row) => r.status,
        fixed: 9,
        show: "always" as const,
        priority: 8,
      },
      {
        header: "Extra",
        get: (r: Row) => r.extra,
        fixed: 20,
        show: "wide" as const,
        priority: 1,
      },
    ];
    const result = renderTable(sampleRows, narrowCols, { width: 30 });
    expect(result).toBeTruthy();
    expect(result).toContain("Nombre");
    expect(result).not.toContain("Extra");
  });

  test("color function is called and returns a value for each cell", () => {
    const colorCalls: string[] = [];
    const colorColumns = [
      {
        header: "Estado",
        get: (r: Row) => r.status,
        weight: 1,
        min: 8,
        show: "always" as const,
        priority: 9,
        color: (v: string) => {
          colorCalls.push(v);
          return `[colored:${v}]`;
        },
      },
    ];
    const result = renderTable(sampleRows, colorColumns, { width: 80 });
    expect(colorCalls.length).toBe(2);
    expect(result).toContain("[colored:");
  });

  test("agent-json columns not shown in human output", () => {
    const withAgentCol = [
      ...columns,
      {
        header: "AgentOnly",
        get: (r: Row) => r.extra,
        fixed: 10,
        show: "agent-json" as const,
        priority: 10,
      },
    ];
    const result = renderTable(sampleRows, withAgentCol, { width: 200 });
    expect(result).not.toContain("AgentOnly");
  });

  test("long strings do not overflow fixed columns ungracefully", () => {
    const longRows = [
      {
        name: "SEMANA05: MECANISMO DE ACCIÓN HORMONAL: HORMONA Y RECEPTOR — TEMA COMPLETO DETALLADO",
        status: "pendiente",
        score: 0,
        notes: "texto",
        extra: "Z",
      },
    ];
    const result = renderTable(longRows, columns, { width: 80 });
    expect(result).toBeTruthy();
    expect(result).not.toContain(
      "SEMANA05: MECANISMO DE ACCIÓN HORMONAL: HORMONA Y RECEPTOR — TEMA COMPLETO DETALLADO",
    );
  });

  test("output is a non-empty string with border characters", () => {
    const result = renderTable(sampleRows, columns, { width: 120 });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/[┌┐└┘│─]/);
  });
});
