// PHASE A WILL REPLACE: Section grouping stub — Phase A provides the authoritative version
// Groups Canvas courses sharing the same course_code into LogicalCourse with secciones[]

import type { CanvasCourse } from "../../types/canvas.js";
import type { Course, LogicalCourse, SectionType } from "../../types/course.js";

const SECTION_PATTERNS: [RegExp, SectionType][] = [
  [/-T$/i, "T"],
  [/-P1$/i, "P1"],
  [/-P2$/i, "P2"],
  [/-P3$/i, "P3"],
  [/-PD$/i, "PD"],
  [/-PE$/i, "PE"],
  [/-L$/i, "L"],
];

export function detectSection(name: string): SectionType {
  for (const [pattern, section] of SECTION_PATTERNS) {
    if (pattern.test(name)) return section;
  }
  return "T";
}

export function groupBySection(courses: Course[]): LogicalCourse[] {
  const byCode = new Map<string, Course[]>();

  for (const course of courses) {
    const existing = byCode.get(course.code) ?? [];
    existing.push(course);
    byCode.set(course.code, existing);
  }

  const result: LogicalCourse[] = [];

  for (const [code, group] of byCode) {
    const primary = group[0];
    if (!primary) continue;

    result.push({
      code,
      name: primary.name,
      alias: primary.alias,
      term: primary.term,
      role: primary.role,
      primaryCourseId: primary.id,
      secciones: group.map((c) => ({
        id: c.id,
        canvasName: c.canvasName,
        seccion: c.section ?? detectSection(c.canvasName),
      })),
    });
  }

  return result.sort((a, b) => a.code.localeCompare(b.code));
}

export function canvasCourseToLogical(
  canvasCourses: CanvasCourse[],
  aliasMap: Map<string, string>
): LogicalCourse[] {
  const courses: Course[] = canvasCourses.map((c) => ({
    id: c.id,
    code: c.course_code,
    name: c.name,
    alias: aliasMap.get(c.course_code) ?? autoAlias(c.name),
    canvasName: c.name,
    term: c.term?.name,
    role: c.enrollments?.[0]?.role ?? "StudentEnrollment",
    section: detectSection(c.name),
    calendarIcsUrl: c.calendar?.ics,
  }));
  return groupBySection(courses);
}

function autoAlias(name: string): string {
  const stopwords = new Set([
    "de", "la", "el", "los", "las", "del", "y", "en", "a", "para",
    "i", "ii", "iii", "iv", "v", "vi", "vii", "viii",
  ]);

  const normalized = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t));

  return normalized[0] ?? name.toLowerCase().slice(0, 8);
}
