// Canonical course types for wiener-cli
// PHASE A WILL REPLACE: Phase A provides the authoritative version of these types

export type SectionType = "T" | "P1" | "P2" | "P3" | "PD" | "PE" | "L" | string;

export interface CourseSection {
  id: number;
  canvasName: string;
  seccion: SectionType;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  alias: string;
  canvasName: string;
  term?: string;
  role: string;
  calendarIcsUrl?: string;
  section?: SectionType;
}

export interface LogicalCourse {
  code: string;
  name: string;
  alias: string;
  secciones: CourseSection[];
  term?: string;
  role: string;
  primaryCourseId: number;
}

export type ResolutionKind = "exact" | "unique-fuzzy" | "ambiguous" | "no-match";

export type Resolution =
  | { kind: "exact"; course: Course; matchedOn: "code" | "alias" }
  | { kind: "unique-fuzzy"; course: Course; score: number; suggested: boolean }
  | { kind: "ambiguous"; candidates: Array<{ course: Course; score: number }> }
  | { kind: "no-match"; closest: Array<{ course: Course; score: number }> };

export interface ResolverOptions {
  exact?: boolean;
  noInput?: boolean;
}
