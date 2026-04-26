import * as cheerio from "cheerio";
import type {
  PagoHistorialItem,
  PagoItem,
  PagosData,
  PagosHistorialData,
} from "../../types/intranet.ts";

function parseMonto(raw: string): number {
  // Handle "S/. 150.00", "150.00", "S/ 150,00"
  const cleaned = raw
    .trim()
    .replace(/S\/\.?\s*/i, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

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

export function parsePagos(html: string): PagosData {
  const $ = cheerio.load(html);
  const items: PagoItem[] = [];
  let totalPendiente = 0;

  // Look for total pendiente
  $("td").each((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    if (
      text.includes("total") &&
      (text.includes("pendiente") || text.includes("deuda") || text.includes("pagar"))
    ) {
      const next = $(el).next("td");
      totalPendiente = totalPendiente || parseMonto(next.text());
    }
  });

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
        (h) => h.includes("concepto") || h.includes("obligación") || h.includes("obligacion"),
      ) &&
      headerTexts.some((h) => h.includes("monto") || h.includes("importe") || h.includes("deuda"))
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { total_pendiente: totalPendiente, items };

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
          t === "concepto" ||
          t === "monto" ||
          t === "importe" ||
          t === "vencimiento" ||
          t === "estado",
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

  const iConcepto = colIndex([
    "concepto",
    "descripción",
    "descripcion",
    "obligación",
    "obligacion",
  ]);
  const iMonto = colIndex(["monto", "importe", "deuda", "total"]);
  const iVencimiento = colIndex(["vencimiento", "fecha", "plazo"]);
  const iEstado = colIndex(["estado", "condición", "condicion"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const concepto = cell(iConcepto);
    if (!concepto) return;

    const monto = parseMonto(cell(iMonto));
    items.push({
      concepto,
      monto,
      vencimiento: parsePeruvianDate(cell(iVencimiento)),
      estado: cell(iEstado),
    });
  });

  // Sum items if total not found from label
  if (!totalPendiente && items.length > 0) {
    totalPendiente = items.reduce((s, item) => s + item.monto, 0);
    totalPendiente = Math.round(totalPendiente * 100) / 100;
  }

  return { total_pendiente: totalPendiente, items };
}

export function parsePagosHistorial(html: string): PagosHistorialData {
  const $ = cheerio.load(html);
  const pagos: PagoHistorialItem[] = [];

  let dataTable: ReturnType<typeof $> | null = null;

  $("table").each((_, table) => {
    const headerTexts = $(table)
      .find("tr")
      .first()
      .find("td, th")
      .map((_, h) => normalizeWhitespace($(h).text()).toLowerCase())
      .get();

    if (
      headerTexts.some((h) => h.includes("concepto") || h.includes("pago")) &&
      headerTexts.some((h) => h.includes("fecha") || h.includes("monto"))
    ) {
      dataTable = $(table);
    }
  });

  if (!dataTable) return { pagos };

  const dt = dataTable as ReturnType<typeof $>;
  const rows = dt.find("tr");
  let headerRow = -1;
  const headers: string[] = [];

  rows.each((i, row) => {
    if (headerRow >= 0) return;
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => normalizeWhitespace($(c).text()).toLowerCase()).get();
    if (
      texts.some((t) => t === "concepto" || t === "fecha" || t === "monto" || t === "fecha pago")
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

  const iConcepto = colIndex(["concepto", "descripción", "descripcion"]);
  const iMonto = colIndex(["monto", "importe", "total"]);
  const iFecha = colIndex(["fecha pago", "fecha de pago", "fecha"]);
  const iComprobante = colIndex(["comprobante", "voucher", "número"]);

  rows.each((i, row) => {
    if (i <= headerRow) return;
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const cell = (idx: number): string =>
      idx >= 0 ? normalizeWhitespace(cells.eq(idx).text()) : "";

    const concepto = cell(iConcepto);
    if (!concepto) return;

    pagos.push({
      concepto,
      monto: parseMonto(cell(iMonto)),
      fecha_pago: parsePeruvianDate(cell(iFecha)),
      comprobante: cell(iComprobante) || undefined,
    });
  });

  return { pagos };
}
