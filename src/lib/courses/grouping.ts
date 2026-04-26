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

export function groupBySection(
  courses: CanvasCourse[],
  aliasMap: Record<string, string> = {},
): LogicalCourse[] {
  const byCode = new Map<string, LogicalCourse>();

  for (const course of courses) {
    const code = course.course_code;
    const { baseName, seccion } = parseSectionFromName(course.name);

    const existing = byCode.get(code);
    if (existing) {
      existing.secciones.push({
        id: course.id,
        seccion,
        name: course.name,
      });
    } else {
      byCode.set(code, {
        code,
        name: baseName,
        alias: aliasMap[code] ?? code.toLowerCase(),
        secciones: [{ id: course.id, seccion, name: course.name }],
        term: course.term?.name,
        role: course.enrollments?.[0]?.role,
      });
    }
  }

  return Array.from(byCode.values());
}
