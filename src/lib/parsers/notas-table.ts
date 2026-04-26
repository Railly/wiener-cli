import * as cheerio from "cheerio";
import type { NotaCurso, NotasData } from "../../types/intranet.ts";

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(raw: string): number | null {
  const s = raw.trim();
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export interface ParseNotasResult {
  data: NotasData;
  periodos: string[];
}

export function parseNotas(html: string): ParseNotasResult {
  const $ = cheerio.load(html);

  // Extract periodo options from select
  const periodos: string[] = [];
  $('select[name="cbo_periodo"] option, select[name="periodo"] option').each((_, el) => {
    const val = $(el).attr("value")?.trim() ?? "";
    if (val && val !== "" && val !== "0") {
      periodos.push(val);
    }
  });

  // Detect selected periodo
  let selectedPeriodo =
    $('select[name="cbo_periodo"] option:selected, select[name="periodo"] option:selected')
      .attr("value")
      ?.trim() ?? "";

  if (!selectedPeriodo || selectedPeriodo === "0") {
    selectedPeriodo = periodos[0] ?? "";
  }

  // Student header info — typically in a header table or labeled cells
  let codigoAlumno = "";
  let carrera = "";
  let ciclo = "";

  // Try common label patterns
  $("table, tbody").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        cells.each((i, cell) => {
          const label = normalizeWhitespace($(cell).text()).toLowerCase();
          const next = cells.eq(i + 1);
          if (label.includes("código") || label.includes("codigo")) {
            codigoAlumno = codigoAlumno || normalizeWhitespace(next.text());
          }
          if (label.includes("carrera")) {
            carrera = carrera || normalizeWhitespace(next.text());
          }
          if (label.includes("ciclo")) {
            ciclo = ciclo || normalizeWhitespace(next.text());
          }
        });
      });
  });

  // Ponderados and orden de mérito
  let ponderadoAcumulado: number | null = null;
  let ponderadoHistorico: number | null = null;
  let ordenMerito: number | null = null;

  $("td").each((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    const next = $(el).next("td");
    if (text.includes("ponderado acumulado") || text.includes("promedio acumulado")) {
      ponderadoAcumulado = ponderadoAcumulado ?? parseNumber(next.text());
    }
    if (text.includes("ponderado histórico") || text.includes("ponderado historico")) {
      ponderadoHistorico = ponderadoHistorico ?? parseNumber(next.text());
    }
    if (text.includes("orden de mérito") || text.includes("orden de merito")) {
      ordenMerito = ordenMerito ?? parseInteger(next.text());
    }
  });

  // Main course table — look for rows with pattern: codigo | nombre | ciclo | creditos | nota | estado | modalidad
  const cursos: NotaCurso[] = [];

  // Find the data table by looking for header row with "Código" or "Curso"
  let dataTable: ReturnType<typeof $> | null = null;
  $("table").each((_, table) => {
    const headers = $(table).find("tr").first().find("td, th");
    const headerTexts = headers.map((_, h) => normalizeWhitespace($(h).text()).toLowerCase()).get();
    if (
      headerTexts.some((h) => h.includes("código") || h.includes("codigo") || h.includes("cód"))
    ) {
      dataTable = $(table);
    }
  });

  if (dataTable !== null) {
    const dt = dataTable as ReturnType<typeof $>;
    const rows = dt.find("tr");
    let headerRow = -1;

    rows.each((i, row) => {
      const cells = $(row).find("td, th");
      const texts = cells.map((_, c) => normalizeWhitespace($(c).text()).toLowerCase()).get();
      if (texts.some((t) => t.includes("código") || t.includes("codigo") || t.includes("cód"))) {
        headerRow = i;
      }
    });

    if (headerRow >= 0) {
      const headerCells =
        $(rows.get(headerRow))
          ?.find("td, th")
          .map((_, c) => normalizeWhitespace($(c).text()).toLowerCase())
          .get() ?? [];

      const colIndex = (terms: string[]): number => {
        for (const term of terms) {
          const idx = headerCells.findIndex((h) => h.includes(term));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const iCodigo = colIndex(["código", "codigo", "cód"]);
      const iNombre = colIndex(["nombre", "curso", "asignatura"]);
      const iCiclo = colIndex(["ciclo", "semestre"]);
      const iCreditos = colIndex(["créditos", "creditos", "créd"]);
      const iNota = colIndex(["nota final", "nota", "promedio"]);
      const iEstado = colIndex(["estado", "condición", "condicion"]);
      const iModalidad = colIndex(["modalidad", "tipo"]);

      rows.each((i, row) => {
        if (i <= headerRow) return;
        const cells = $(row).find("td");
        if (cells.length < 3) return;

        const cell = (idx: number): string =>
          idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

        const codigo = cell(iCodigo);
        if (!codigo || codigo.toLowerCase() === "código" || codigo.toLowerCase() === "codigo")
          return;

        cursos.push({
          codigo,
          nombre: cell(iNombre),
          ciclo: cell(iCiclo),
          creditos: parseNumber(cell(iCreditos)) ?? 0,
          nota_final: parseNumber(cell(iNota)),
          estado: cell(iEstado),
          modalidad: cell(iModalidad),
        });
      });
    }
  }

  return {
    data: {
      periodo: selectedPeriodo,
      alumno: { codigo: codigoAlumno, carrera, ciclo },
      ponderado_acumulado: ponderadoAcumulado,
      ponderado_historico: ponderadoHistorico,
      orden_merito: ordenMerito,
      cursos,
    },
    periodos,
  };
}

export function parsePeriodos(html: string): string[] {
  const $ = cheerio.load(html);
  const periodos: string[] = [];
  $('select[name="cbo_periodo"] option, select[name="periodo"] option').each((_, el) => {
    const val = $(el).attr("value")?.trim() ?? "";
    if (val && val !== "" && val !== "0") {
      periodos.push(val);
    }
  });
  return periodos;
}
