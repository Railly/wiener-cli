import * as cheerio from "cheerio";
import type { DiaCode, HorarioBloque, HorarioData } from "../../types/intranet.ts";

const DAY_MAP: Record<string, DiaCode> = {
  lunes: "L",
  martes: "M",
  miércoles: "X",
  miercoles: "X",
  jueves: "J",
  viernes: "V",
  sábado: "S",
  sabado: "S",
  domingo: "D",
  l: "L",
  m: "M",
  x: "X",
  j: "J",
  v: "V",
  s: "S",
  d: "D",
  lun: "L",
  mar: "M",
  mié: "X",
  mie: "X",
  jue: "J",
  vie: "V",
  sáb: "S",
  sab: "S",
  dom: "D",
};

function parseTime(raw: string): string {
  // Handles: "07:00 a. m.", "07:00 a.m.", "07:00 am", "07:00 AM", "7:00"
  // Returns 24h "HH:MM"
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(?:(a\.?\s*m\.?)|(p\.?\s*m\.?))?/);
  if (!match) return raw.trim();

  let hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = match[2] ?? "00";
  const isAm = !!match[3];
  const isPm = !!match[4];

  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function parseTimeRange(raw: string): { time_start: string; time_end: string } | null {
  const parts = raw.split(/[-–—]/);
  if (parts.length < 2) return null;
  const start = parseTime(parts[0] ?? "");
  const end = parseTime(parts.slice(1).join("-"));
  if (!start || !end) return null;
  return { time_start: start, time_end: end };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function mapDay(raw: string): DiaCode | null {
  const key = stripAccents(raw.toLowerCase().trim());
  return DAY_MAP[key] ?? null;
}

export function parseHorario(html: string): HorarioData {
  const $ = cheerio.load(html);

  const emptyDias = (): Record<DiaCode, HorarioBloque[]> => ({
    L: [],
    M: [],
    X: [],
    J: [],
    V: [],
    S: [],
    D: [],
  });

  const dias = emptyDias();

  // Extract semana header if present — may be in p, td, th, span, div, caption
  let semana = "";
  $("p, caption, td, th, span, div, h1, h2, h3, h4").each((_, el) => {
    if (semana) return;
    const text = normalizeWhitespace($(el).text());
    if (/semana|week/i.test(text) && /\d{4}/.test(text)) {
      semana = text;
    }
  });
  // Fallback: any text node containing a date range
  if (!semana) {
    $("p, caption").each((_, el) => {
      if (semana) return;
      const text = normalizeWhitespace($(el).text());
      if (
        /\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(
          text,
        )
      ) {
        semana = text;
      }
    });
  }

  // Find the horario table — typically the biggest table or one with day headers
  let horarioTable: ReturnType<typeof $> | null = null;

  $("table").each((_, table) => {
    const firstRow = $(table).find("tr").first();
    const headers = firstRow.find("td, th");
    const texts = headers.map((_, h) => stripAccents($(h).text().toLowerCase().trim())).get();
    const dayCount = texts.filter((t) => mapDay(t) !== null).length;
    if (dayCount >= 5) {
      horarioTable = $(table);
    }
  });

  if (!horarioTable) {
    // Fallback: try any table with rows that look like time slots
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      if (rows.length > 3) {
        horarioTable = horarioTable ?? $(table);
      }
    });
  }

  if (!horarioTable) {
    return { semana, dias };
  }

  const ht = horarioTable as ReturnType<typeof $>;
  const rows = ht.find("tr");

  // Detect column → day mapping from header row
  const columnDays: (DiaCode | null)[] = [];
  let headerRowIndex = -1;

  rows.each((i, row) => {
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => stripAccents($(c).text().toLowerCase().trim())).get();
    const dayCount = texts.filter((t) => mapDay(t) !== null).length;
    if (dayCount >= 4) {
      headerRowIndex = i;
      texts.forEach((t) => {
        columnDays.push(mapDay(t));
      });
    }
  });

  if (headerRowIndex < 0 || columnDays.length === 0) {
    return { semana, dias };
  }

  // Parse data rows
  rows.each((rowIdx, row) => {
    if (rowIdx <= headerRowIndex) return;
    const cells = $(row).find("td");
    if (cells.length === 0) return;

    // First cell is often the time range
    const firstCellText = normalizeWhitespace(cells.eq(0).text());
    const timeRange = parseTimeRange(firstCellText);
    const timeStartCol = timeRange !== null ? 0 : -1;

    cells.each((colIdx, cell) => {
      if (colIdx === timeStartCol) return;
      const dayCode = columnDays[colIdx];
      if (!dayCode) return;

      const cellText = normalizeWhitespace($(cell).text());
      if (!cellText) return;

      // Each cell may contain: course code, course name, section, type, room, teacher
      // Pattern varies — try to extract meaningful data
      const lines = cellText
        .split(/\n|<br>/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return;

      // Look for time in this cell if no time column
      let time_start = timeRange?.time_start ?? "";
      let time_end = timeRange?.time_end ?? "";

      if (timeStartCol < 0) {
        for (const line of lines) {
          const tr = parseTimeRange(line);
          if (tr) {
            time_start = tr.time_start;
            time_end = tr.time_end;
            break;
          }
        }
      } else if (timeRange) {
        time_start = timeRange.time_start;
        time_end = timeRange.time_end;
      }

      if (!time_start || !time_end) return;

      // Parse the cell content — heuristic extraction
      // Typical format varies but we extract what we can
      const bloque: HorarioBloque = {
        time_start,
        time_end,
        course_code: "",
        course_name: "",
        section: "",
        type: "",
        room: "",
        building: "",
        attribute: "",
        teacher: "",
      };

      // Try to extract course code (all-caps + digits pattern like FB6N1, AC6M28)
      for (const line of lines) {
        const codeMatch = line.match(/\b([A-Z]{2,4}[0-9][A-Z][0-9]{1,2})\b/);
        if (codeMatch?.[1]) {
          bloque.course_code = codeMatch[1];
          const nameStart = line.indexOf(bloque.course_code) + bloque.course_code.length;
          bloque.course_name = line
            .slice(nameStart)
            .replace(/^[-\s]+/, "")
            .trim();
          break;
        }
      }

      // Fallback: first non-time line is course name
      if (!bloque.course_code && lines.length > 0) {
        bloque.course_name = lines[0] ?? "";
      }

      // Teacher is often last line (surname, name pattern)
      if (lines.length > 1) {
        const lastLine = lines[lines.length - 1] ?? "";
        if (lastLine.includes(",") || /^[A-Z]/.test(lastLine)) {
          bloque.teacher = lastLine;
        }
      }

      // Room/aula detection
      for (const line of lines) {
        if (/aula|salon|lab|remoto|videoconf/i.test(line)) {
          bloque.room = line;
          if (/remoto|videoconf/i.test(line)) {
            bloque.type = "remoto";
          }
        }
      }

      dias[dayCode]?.push(bloque);
    });
  });

  return { semana, dias };
}
