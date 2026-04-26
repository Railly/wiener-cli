// PHASE A WILL REPLACE — stub; shape matches Phase A contract

export interface Course {
  id: string;
  course_code: string;
  name: string;
  alias?: string;
  term?: string;
  role?: string;
}

export interface Section {
  id: string;
  course_id: string;
  name: string;
  seccion: string;
}

export interface LogicalCourse {
  code: string;
  name: string;
  alias: string;
  secciones: Section[];
  term?: string;
  role?: string;
}

export interface AliasMap {
  [courseCode: string]: string;
}

export type Resolution =
  | { kind: "exact"; course: Course; matchedOn: "code" | "alias" }
  | { kind: "unique-fuzzy"; course: Course; score: number; suggested: boolean }
  | { kind: "ambiguous"; candidates: Array<{ course: Course; score: number }> }
  | { kind: "no-match"; closest: Array<{ course: Course; score: number }> };

export interface ResolverOptions {
  fuzzyConfirmThreshold?: number;
  fuzzyUniqueDelta?: number;
  noInputAutoThreshold?: number;
  noMatchTopN?: number;
  exact?: boolean;
  noInput?: boolean;
}
