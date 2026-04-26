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
  // Must contain at least one colon — real times look like "07:00 a.m. - 10:00 a.m."
  if (!raw.includes(":")) return null;
  const parts = raw.split(/[-–—]/);
  if (parts.length < 2) return null;
  const start = parseTime(parts[0] ?? "");
  const end = parseTime(parts.slice(1).join("-"));
  // Validate: start and end must match time pattern (HH:MM)
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
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

/**
 * Extract text lines from a cell element preserving structure.
 *
 * Key insight: The Wiener intranet uses two cell formats:
 *
 * 1. Plain text with \n newlines (old/simple pages):
 *    <td>AC6M28 · CIENCIA Y DESCUBRIMIENTO\nRemoto-Videoconf\nProf. García, Luis</td>
 *
 * 2. Span children (detailed view):
 *    <td><span>AC6M28</span><span>AC4061 - CIENCIA Y DESCUBRIMIENTO</span>...</td>
 *
 * We handle both by:
 * - Walking child nodes
 * - For text nodes: splitting on \n to get individual lines
 * - For element nodes (span, etc.): taking their .text() as one line
 */
function extractCellLines($: ReturnType<typeof cheerio.load>, cell: cheerio.AnyNode): string[] {
  const rawLines: string[] = [];
  const cellEl = $(cell);

  cellEl.contents().each((_, node) => {
    if (node.type === "text") {
      // Split text node by newlines BEFORE normalizing whitespace
      const data = (node as { data?: string }).data ?? "";
      const parts = data.split(/\n/);
      for (const part of parts) {
        const cleaned = normalizeWhitespace(part);
        if (cleaned) rawLines.push(cleaned);
      }
    } else if (node.type === "tag") {
      const tagEl = $(node);
      const tagName =
        (node as { tagName?: string }).tagName ?? (node as { name?: string }).name ?? "";
      if (tagName === "br") {
        // br = line separator, no content to add
      } else {
        // Recursively get span/div/p text as one line
        const innerText = normalizeWhitespace(tagEl.text());
        if (innerText) rawLines.push(innerText);
      }
    }
  });

  // Filter empty and return
  return rawLines.filter((l) => l.trim().length > 0);
}

// Regex patterns for field recognition
const COURSE_CODE_RE = /\b([A-Z]{2,4}[0-9][A-Z][0-9]{1,2})\b/;
// Internal section/course ID: like AC4061, FB4089 (letters + 4-5 digits, NO letter after first digit)
const INTERNAL_ID_RE = /^[A-Z]{2,4}\d{4,5}$/;
// Teacher patterns: "APELLIDO, Nombre" or "Prof. APELLIDO, Nombre" or "Docente APELLIDO, Nombre"
const TEACHER_PREFIX_RE = /^(?:Prof\.\s*|Docente\s+)/i;
const TEACHER_COMMA_RE = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+,\s+\S/;
// Type patterns
const TYPE_RE = /^(Teor[íi]a|Teoria|Pr[áa]ctica(?:\s*[-–]\s*\d+|[-–][A-Z])?)\s*$/i;
// Attribute
const ATTR_RE = /\b(REGULAR|CONVALIDADO|LIBRE|DESAPROBADO|APROBADO)\b/i;
// Room labels
const ROOM_LABEL_RE = /^(?:Aula:?\s*|Sal[oó]n:?\s*|Lab(?:oratorio)?:?\s*|Ambiente:?\s*)/i;
const ROOM_CODE_RE = /\b([A-Z]{1,3}\d{3})\b/;
// Building/location patterns
const BUILDING_EXPLICIT_RE = /^(?:Sede:?\s*|Local:?\s*|Campus:?\s*)/i;
const BUILDING_NAMES_RE =
  /(?:Sede Virtual|Sede\s+\w+|Local\s+\d+|Remoto[-–]?Videoconf|Campus\s+\w+)/i;
// Remote/virtual
const REMOTE_RE = /remoto|videoconf|virtual/i;
// Atributo label
const ATRIBUTO_LABEL_RE = /^Atributo:\s*/i;

/**
 * Strip a line of known prefix labels (Aula:, Sede:, Atributo:, Docente, Prof.)
 * and return the clean value.
 */
function stripLabel(line: string): string {
  return line
    .replace(ROOM_LABEL_RE, "")
    .replace(BUILDING_EXPLICIT_RE, "")
    .replace(ATRIBUTO_LABEL_RE, "")
    .replace(TEACHER_PREFIX_RE, "")
    .trim();
}

/**
 * Parse a single cell's lines into a structured HorarioBloque.
 *
 * Fields extracted cleanly and separately:
 * - course_code: e.g. "AC6M28"
 * - course_name: e.g. "CIENCIA Y DESCUBRIMIENTO" (no code, no ID, no teacher, no room)
 * - type: "Teoria" / "Practica" / "Practica - 1"
 * - room: "305", "WA201"
 * - building: "Sede Virtual", "Remoto-Videoconf"
 * - attribute: "REGULAR"
 * - teacher: "RAMIREZ, Agustina"
 */
function parseCellToBloque(
  lines: string[],
  time_start: string,
  time_end: string,
): HorarioBloque | null {
  if (lines.length === 0) return null;

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

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine);
    if (!line) continue;

    // Skip time-range lines (they appear as duplicates in detailed view)
    if (parseTimeRange(line) !== null) continue;

    // ── Teacher (highest priority after code — must check before name fallback) ──
    if (!bloque.teacher) {
      if (TEACHER_PREFIX_RE.test(line)) {
        bloque.teacher = stripLabel(line);
        continue;
      }
      // "APELLIDO, Nombre" pattern without prefix (must have uppercase start + comma)
      if (
        /^[A-ZÁÉÍÓÚÑ]{2,}[A-ZÁÉÍÓÚÑa-záéíóúñ\s]*,\s*\S/.test(line) &&
        !COURSE_CODE_RE.test(line)
      ) {
        bloque.teacher = line;
        continue;
      }
    }

    // ── Attribute label (e.g. "Atributo: REGULAR") ────────────────────────────
    if (ATRIBUTO_LABEL_RE.test(line)) {
      bloque.attribute = stripLabel(line);
      continue;
    }

    // ── Attribute standalone ───────────────────────────────────────────────────
    if (!bloque.attribute) {
      const attrMatch = ATTR_RE.exec(line);
      if (attrMatch?.[1] && line.trim() === attrMatch[1]) {
        bloque.attribute = attrMatch[1];
        continue;
      }
    }

    // ── Type (Teoria/Practica) ─────────────────────────────────────────────────
    if (!bloque.type && TYPE_RE.test(line)) {
      bloque.type = normalizeWhitespace(line);
      continue;
    }

    // ── Building explicit label (Sede: ...) ───────────────────────────────────
    if (BUILDING_EXPLICIT_RE.test(line)) {
      bloque.building = stripLabel(line);
      continue;
    }

    // ── Room label (Aula: ...) ─────────────────────────────────────────────────
    if (ROOM_LABEL_RE.test(line)) {
      const roomValue = stripLabel(line);
      if (REMOTE_RE.test(roomValue)) {
        // "Remoto-Videoconf" is building, not room
        if (!bloque.building) bloque.building = roomValue;
        if (!bloque.room) bloque.room = "Remoto";
      } else {
        if (!bloque.room) bloque.room = roomValue;
      }
      continue;
    }

    // ── Building name inline (no label) ───────────────────────────────────────
    if (!bloque.building) {
      const buildingMatch = BUILDING_NAMES_RE.exec(line);
      if (buildingMatch) {
        bloque.building = normalizeWhitespace(buildingMatch[0]);
        // If the whole line is just the building, skip — don't set as name
        if (normalizeWhitespace(line) === bloque.building) continue;
      }
    }

    // ── Remote/virtual inline (no label, no building yet) ─────────────────────
    if (!bloque.building && !bloque.room && REMOTE_RE.test(line)) {
      bloque.building = normalizeWhitespace(line);
      bloque.room = "Remoto";
      continue;
    }

    // ── Course code + name extraction ─────────────────────────────────────────
    if (!bloque.course_code) {
      const codeMatch = COURSE_CODE_RE.exec(line);
      if (codeMatch?.[1]) {
        bloque.course_code = codeMatch[1];

        // Extract name: everything after code, strip separators
        let rest = line.slice(line.indexOf(bloque.course_code) + bloque.course_code.length);
        rest = rest.replace(/^[\s·\-–—·:]+/, "").trim();

        // Strip leading internal section ID if present (e.g. "AC4061 - CIENCIA...")
        // Match: uppercase letters + 4-5 digits at start, followed by separator
        const secIdMatch = rest.match(/^([A-Z]{2,4}\d{4,5})\s*[-–—·:]\s*/);
        if (secIdMatch?.[1]) {
          rest = rest.slice(secIdMatch[0].length).trim();
        }

        if (rest && !bloque.course_name) {
          bloque.course_name = rest;
        }
        continue;
      }
    }

    // ── Internal ID line without a preceding code (detailed fixture span) ──────
    // A line like "AC4061 - CIENCIA Y DESCUBRIMIENTO" when code is already set
    if (bloque.course_code && !bloque.course_name) {
      // Check if line starts with internal ID + separator
      const internalIdLineMatch = line.match(/^([A-Z]{2,4}\d{4,5})\s*[-–—]\s*(.+)$/);
      if (internalIdLineMatch?.[2]) {
        bloque.course_name = normalizeWhitespace(internalIdLineMatch[2]);
        continue;
      }

      // Single internal ID token (no name on same line) — skip it
      if (INTERNAL_ID_RE.test(line.trim())) {
        continue;
      }
    }

    // ── Course name fallback ───────────────────────────────────────────────────
    // If code is set and name still empty, treat this line as name if it doesn't
    // look like any other field
    if (bloque.course_code && !bloque.course_name) {
      const isMetaLine =
        TEACHER_COMMA_RE.test(line) ||
        TEACHER_PREFIX_RE.test(line) ||
        TYPE_RE.test(line) ||
        ATTR_RE.test(line) ||
        ROOM_LABEL_RE.test(line) ||
        BUILDING_EXPLICIT_RE.test(line) ||
        REMOTE_RE.test(line) ||
        BUILDING_NAMES_RE.test(line) ||
        parseTimeRange(line) !== null;
      if (!isMetaLine) {
        bloque.course_name = line;
      }
    }
  }

  // Fallback: if no course code found at all, use first non-meta line as name
  if (!bloque.course_code && !bloque.course_name && lines.length > 0) {
    bloque.course_name = normalizeWhitespace(lines[0] ?? "");
  }

  if (!bloque.course_code && !bloque.course_name) return null;

  return bloque;
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

  // Extract semana header
  let semana = "";
  $("p, caption, td, th, span, div, h1, h2, h3, h4").each((_, el) => {
    if (semana) return;
    const text = normalizeWhitespace($(el).text());
    if (/semana|week/i.test(text) && /\d{4}/.test(text)) {
      semana = text;
    }
  });
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

  // Find the horario table
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

      // Extract structured lines from cell (handles both text-with-newlines and span children)
      const lines = extractCellLines($, cell);
      if (lines.length === 0) return;

      // Determine time range
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
      }

      if (!time_start || !time_end) return;

      const bloque = parseCellToBloque(lines, time_start, time_end);
      if (bloque) {
        dias[dayCode]?.push(bloque);
      }
    });
  });

  return { semana, dias };
}
