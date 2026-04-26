import * as cheerio from "cheerio";
import type { HistorialData, HistorialCiclo, HistorialCurso } from "../../types/intranet.ts";

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s || s === "-" || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseHistorial(html: string): HistorialData {
  const $ = cheerio.load(html);
  const ciclos: HistorialCiclo[] = [];
  let currentCiclo: HistorialCiclo | null = null;

  // Scan all tables, looking for periodo headers and course rows
  $("table").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).find("td, th");
        const texts = cells.map((_, c) => normalizeWhitespace($(c).text())).get();

        if (texts.length === 0) return;

        // Detect periodo header (e.g. "2026-I", "2025-II")
        const periodoPattern = /^\d{4}-[I]{1,3}$|\d{4}-[123]/;
        const periodoCell = texts.find((t) => periodoPattern.test(t.trim()));
        if (periodoCell) {
          currentCiclo = { periodo: periodoCell.trim(), cursos: [] };
          ciclos.push(currentCiclo);
          return;
        }

        if (!currentCiclo) return;

        // Skip header rows
        if (texts.some((t) => /código|codigo|nombre|crédito|credito|nota/i.test(t))) return;
        if (texts.length < 2) return;

        const codigo = texts[0]?.trim() ?? "";
        if (!codigo || codigo === "") return;

        const curso: HistorialCurso = {
          codigo,
          nombre: texts[1]?.trim() ?? "",
          creditos: parseNumber(texts[2] ?? "") ?? 0,
          nota_final: parseNumber(texts[3] ?? ""),
          estado: texts[4]?.trim() ?? "",
        };

        currentCiclo.cursos.push(curso);
      });
  });

  return { ciclos };
}
