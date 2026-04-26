import * as cheerio from "cheerio";
import type { ExamenItem, ExamenesData } from "../../types/intranet.ts";

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parsePeruvianDate(raw: string): string {
  // Parse DD/MM/YYYY → ISO 8601 YYYY-MM-DD
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = String(match[1]).padStart(2, "0");
    const month = String(match[2]).padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return raw.trim();
}

export function parseExamenes(html: string): ExamenesData {
  const $ = cheerio.load(html);
  const examenes: ExamenItem[] = [];

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
          h.includes("fecha") ||
          h.includes("examen") ||
          h.includes("aula") ||
          h.includes("modalidad"),
      )
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { examenes };

  const dt = dataTable as ReturnType<typeof $>;
  const rows = dt.find("tr");
  let headerRow = -1;
  const headers: string[] = [];

  rows.each((i, row) => {
    if (headerRow >= 0) return;
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => normalizeWhitespace($(c).text()).toLowerCase()).get();
    // Header row: must contain COLUMN LABEL words, not data values
    // Require at least one of these EXACT label words
    if (
      texts.some(
        (t) =>
          t === "fecha" ||
          t === "hora" ||
          t === "aula" ||
          t === "modalidad" ||
          t === "examen" ||
          t.includes("nombre del curso") ||
          t.includes("asignatura"),
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

  const iFecha = colIndex(["fecha"]);
  const iHora = colIndex(["hora"]);
  const iCurso = colIndex(["curso", "asignatura", "nombre"]);
  const iModalidad = colIndex(["modalidad", "tipo"]);
  const iAula = colIndex(["aula", "ambiente", "salon"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const fecha = cell(iFecha);
    if (!fecha) return;

    examenes.push({
      fecha: parsePeruvianDate(fecha),
      hora: cell(iHora),
      curso: cell(iCurso),
      modalidad: cell(iModalidad),
      aula: cell(iAula),
    });
  });

  return { examenes };
}
