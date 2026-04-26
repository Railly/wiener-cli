import type { CanvasCourse, LogicalCourse, Section } from "../../../src/types/course.js";

const SECTION_SUFFIXES = /[-\s]+(T|P1|P2|P3|PD|PE|L|P)\s*$/i;

export function parseSectionFromName(name: string): { baseName: string; seccion: Section } {
  const match = SECTION_SUFFIXES.exec(name);
  if (match?.[1]) {
    const baseName = name.slice(0, match.index).trim();
    return { baseName, seccion: match[1].toUpperCase() as Section };
  }
  return { baseName: name.trim(), seccion: "T" };
}

function normalizeBaseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function groupBySection(
  courses: CanvasCourse[],
  aliasMap: Record<string, string> = {},
): LogicalCourse[] {
  const byKey = new Map<string, LogicalCourse>();

  for (const course of courses) {
    const code = course.course_code;
    if (!code) continue;

    const { baseName, seccion } = parseSectionFromName(course.name ?? "");
    const cleanedBaseName = baseName.replace(new RegExp(`^${code}\\s*-\\s*`, "i"), "");
    const key = `${code}::${normalizeBaseName(cleanedBaseName)}`;

    const aliasKey = `${code}::${(course.name ?? "").trim()}`;
    const alias = aliasMap[aliasKey] ?? aliasMap[code] ?? code.toLowerCase();

    const existing = byKey.get(key);
    if (existing) {
      existing.secciones.push({
        id: course.id,
        seccion,
        name: course.name ?? "",
      });
    } else {
      byKey.set(key, {
        code,
        name: cleanedBaseName || baseName,
        alias,
        secciones: [{ id: course.id, seccion, name: course.name ?? "" }],
        term: course.term?.name,
        role: course.enrollments?.[0]?.role,
      });
    }
  }

  return Array.from(byKey.values());
}
