import * as cheerio from "cheerio";
import type { MatriculaCurso, MatriculaData } from "../../types/intranet.ts";

function parseNumber(raw: string): number {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseMatricula(html: string): MatriculaData {
  const $ = cheerio.load(html);

  let periodo = "";
  let ciclo = "";

  $("td").each((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    const next = $(el).next("td");
    const val = normalizeWhitespace(next.text());
    if (text.includes("período") || text.includes("periodo")) {
      periodo = periodo || val;
    }
    if (text.includes("ciclo")) {
      ciclo = ciclo || val;
    }
  });

  const cursos: MatriculaCurso[] = [];

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
        (h) => h.includes("código") || h.includes("codigo") || h.includes("curso"),
      ) &&
      headerTexts.some(
        (h) =>
          h.includes("crédito") ||
          h.includes("credito") ||
          h.includes("sección") ||
          h.includes("seccion"),
      )
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { periodo, ciclo, cursos };

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
          t === "código" ||
          t === "codigo" ||
          t === "cód" ||
          t === "créditos" ||
          t === "creditos" ||
          t === "sección" ||
          t === "seccion",
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
  const iCreditos = colIndex(["créditos", "creditos", "créd"]);
  const iSeccion = colIndex(["sección", "seccion"]);
  const iModalidad = colIndex(["modalidad", "tipo"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const codigo = cell(iCodigo);
    if (!codigo) return;

    cursos.push({
      codigo,
      nombre: cell(iNombre),
      creditos: parseNumber(cell(iCreditos)),
      seccion: cell(iSeccion),
      modalidad: cell(iModalidad),
    });
  });

  return { periodo, ciclo, cursos };
}
