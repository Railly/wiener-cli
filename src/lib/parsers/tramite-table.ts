import * as cheerio from "cheerio";
import type { TramiteData, TramiteItem } from "../../types/intranet.ts";

function parsePeruvianDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = String(match[1]).padStart(2, "0");
    const month = String(match[2]).padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return raw.trim() || null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseTramite(html: string): TramiteData {
  const $ = cheerio.load(html);
  const tramites: TramiteItem[] = [];

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
        (h) => h.includes("trámite") || h.includes("tramite") || h.includes("tipo") || h.includes("solicitud"),
      )
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { tramites };

  const dt = dataTable as ReturnType<typeof $>;
  const rows = dt.find("tr");
  let headerRow = -1;
  const headers: string[] = [];

  rows.each((i, row) => {
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => normalizeWhitespace($(c).text()).toLowerCase()).get();
    if (texts.some((t) => t.includes("tipo") || t.includes("trámite") || t.includes("tramite"))) {
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

  const iId = colIndex(["n°", "número", "id", "codigo"]);
  const iTipo = colIndex(["tipo", "trámite", "tramite", "solicitud"]);
  const iEstado = colIndex(["estado", "situación", "situacion"]);
  const iFecha = colIndex(["fecha", "inicio"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const tipo = cell(iTipo);
    if (!tipo) return;

    tramites.push({
      id: cell(iId) || String(i),
      tipo,
      estado: cell(iEstado),
      fecha_inicio: parsePeruvianDate(cell(iFecha)),
    });
  });

  return { tramites };
}
