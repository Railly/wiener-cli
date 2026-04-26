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

function stripCodePrefix(name: string, code: string): string {
  const prefix = `${code} - `;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  const prefixNoSpace = `${code}-`;
  if (name.startsWith(prefixNoSpace)) return name.slice(prefixNoSpace.length);
  return name;
}

export function groupBySection(
  courses: CanvasCourse[],
  aliasMap: Record<string, string> = {},
): LogicalCourse[] {
  const byCodeName = new Map<string, LogicalCourse>();

  for (const course of courses) {
    const code = course.course_code;
    const { baseName: rawBaseName, seccion } = parseSectionFromName(course.name);
    const baseName = stripCodePrefix(rawBaseName, code);
    const key = `${code}::${baseName}`;

    const existing = byCodeName.get(key);
    if (existing) {
      existing.secciones.push({
        id: course.id,
        seccion,
        name: course.name,
      });
    } else {
      const alias = aliasMap[key] ?? aliasMap[code] ?? code.toLowerCase();
      byCodeName.set(key, {
        code,
        name: baseName,
        alias,
        secciones: [{ id: course.id, seccion, name: course.name }],
        term: course.term?.name,
        role: course.enrollments?.[0]?.role,
      });
    }
  }

  return Array.from(byCodeName.values());
}
