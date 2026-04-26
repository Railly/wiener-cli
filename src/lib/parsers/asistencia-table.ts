import * as cheerio from "cheerio";
import type { AsistenciaCurso, AsistenciaData } from "../../types/intranet.ts";

function parseNumber(raw: string): number {
  const n = Number.parseFloat(raw.trim().replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseAsistencia(html: string): AsistenciaData {
  const $ = cheerio.load(html);
  const cursos: AsistenciaCurso[] = [];

  // Find the table with asistencia data
  let dataTable: ReturnType<typeof $> | null = null;

  $("table").each((_, table) => {
    const headerTexts = $(table)
      .find("tr")
      .first()
      .find("td, th")
      .map((_, h) => normalizeWhitespace($(h).text()).toLowerCase())
      .get();

    if (
      headerTexts.some(
        (h) =>
          h.includes("asistencia") ||
          h.includes("falta") ||
          h.includes("tardanza") ||
          h.includes("porcentaje"),
      )
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { cursos };

  const dt = dataTable as ReturnType<typeof $>;
  const rows = dt.find("tr");
  let headerRow = -1;
  const headers: string[] = [];

  rows.each((i, row) => {
    if (headerRow >= 0) return;
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => normalizeWhitespace($(c).text()).toLowerCase()).get();
    if (
      texts.some(
        (t) =>
          t === "asistencias" ||
          t === "asistencia" ||
          t === "faltas" ||
          t === "falta" ||
          t === "tardanzas" ||
          t === "porcentaje" ||
          t === "código" ||
          t === "codigo",
      )
    ) {
      headerRow = i;
      headers.push(...texts);
    }
  });

  const colIndex = (terms: string[]): number => {
    for (const term of terms) {
      const idx = headers.findIndex((h) => h.includes(term));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iCodigo = colIndex(["código", "codigo", "cód"]);
  const iNombre = colIndex(["nombre", "curso", "asignatura"]);
  const iTotalClases = colIndex([
    "total clases",
    "total de clases",
    "n° clases",
    "num clases",
    "total",
  ]);
  const iAsistencias = colIndex(["asistencias", "asistencia", "n° asistencias"]);
  const iFaltas = colIndex(["faltas", "falta", "n° faltas", "inasistencias"]);
  const iTardanzas = colIndex(["tardanzas", "tardanza"]);
  const iPorcentaje = colIndex(["porcentaje", "%", "porcent"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const codigo = cell(iCodigo);
    if (!codigo) return;

    cursos.push({
      codigo,
      nombre: cell(iNombre),
      total_clases: parseNumber(cell(iTotalClases)),
      asistencias: parseNumber(cell(iAsistencias)),
      faltas: parseNumber(cell(iFaltas)),
      tardanzas: parseNumber(cell(iTardanzas)),
      porcentaje: parseNumber(cell(iPorcentaje)),
    });
  });

  return { cursos };
}
