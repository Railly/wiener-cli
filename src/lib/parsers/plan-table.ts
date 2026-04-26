import * as cheerio from "cheerio";
import type { PlanAvanceData, PlanCiclo, PlanCurso, PlanData } from "../../types/intranet.ts";

function parseNumber(raw: string): number {
  const n = Number.parseFloat(raw.trim().replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function parseInteger(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parsePlan(html: string): PlanData {
  const $ = cheerio.load(html);

  let carrera = "";

  // Extract carrera from page
  $("td").each((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    if (text.includes("carrera")) {
      const next = $(el).next("td");
      if (next.length) {
        carrera = carrera || normalizeWhitespace(next.text());
      }
    }
  });

  const ciclos: PlanCiclo[] = [];
  let currentCiclo: PlanCiclo | null = null;

  // Look for ciclo markers (cells with "ciclo" or roman numerals or numbers)
  $("table tr").each((_, row) => {
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => normalizeWhitespace($(c).text())).get();

    // Detect ciclo header row
    if (texts.length === 1 || texts.some((t) => /^(ciclo|semestre)\s*[IVX0-9]/i.test(t))) {
      const cicloText = texts.find((t) => /^(ciclo|semestre|^[IVX]+$|\d+)/i.test(t));
      if (cicloText) {
        currentCiclo = { ciclo: cicloText.trim(), cursos: [] };
        ciclos.push(currentCiclo);
        return;
      }
    }

    if (!currentCiclo) return;

    // Skip header rows
    if (texts.some((t) => /código|codigo|nombre|crédito|credito/i.test(t))) return;
    if (texts.length < 2) return;

    const codigo = texts[0]?.trim() ?? "";
    const nombre = texts[1]?.trim() ?? "";

    if (!codigo || /ciclo|semestre/i.test(codigo)) return;

    const curso: PlanCurso = {
      codigo,
      nombre,
      creditos: texts.length > 2 ? parseNumber(texts[2] ?? "") : 0,
      tipo: texts.length > 3 ? (texts[3] ?? "").trim() : "",
      estado: texts.length > 4 ? (texts[4] ?? "").trim() : undefined,
    };

    currentCiclo.cursos.push(curso);
  });

  return { carrera, ciclos };
}

export function parsePlanAvance(html: string): PlanAvanceData {
  const $ = cheerio.load(html);

  let creditosAprobados = 0;
  let creditosTotal = 0;
  let cursosAprobados = 0;
  let cursosPendientes = 0;
  let porcentaje = 0;

  $("td").each((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    const next = $(el).next("td");
    const val = normalizeWhitespace(next.text());

    if (text.includes("créditos aprobados") || text.includes("creditos aprobados")) {
      creditosAprobados = creditosAprobados || parseNumber(val);
    }
    if (
      text.includes("créditos totales") ||
      text.includes("creditos totales") ||
      text.includes("total de créditos") ||
      text.includes("total creditos")
    ) {
      creditosTotal = creditosTotal || parseNumber(val);
    }
    if (text.includes("cursos aprobados")) {
      cursosAprobados = cursosAprobados || parseInteger(val);
    }
    if (text.includes("cursos pendientes") || text.includes("por aprobar")) {
      cursosPendientes = cursosPendientes || parseInteger(val);
    }
    if (text.includes("porcentaje") || text.includes("avance")) {
      porcentaje = porcentaje || parseNumber(val);
    }
  });

  // Compute porcentaje if not found but have data
  if (!porcentaje && creditosTotal > 0) {
    porcentaje = Math.round((creditosAprobados / creditosTotal) * 100 * 10) / 10;
  }

  return {
    creditos_aprobados: creditosAprobados,
    creditos_total: creditosTotal,
    cursos_aprobados: cursosAprobados,
    cursos_pendientes: cursosPendientes,
    porcentaje,
  };
}
