export type Section = "T" | "P" | "P1" | "P2" | "PD" | "PE" | "L" | string;

export interface CanvasCourse {
  id: string;
  name: string;
  course_code: string;
  enrollment_state: string;
  term?: {
    id: string;
    name: string;
  };
  enrollments?: Array<{ type: string; role: string }>;
  seccion?: Section;
}

export interface LogicalCourse {
  code: string;
  name: string;
  alias: string;
  secciones: Array<{
    id: string;
    seccion: Section;
    name: string;
  }>;
  term?: string;
  role?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  alias: string;
  secciones: Array<{
    id: string;
    seccion: Section;
    name: string;
  }>;
  term?: string;
  role?: string;
}

export interface Alias {
  code: string;
  alias: string;
  custom: boolean;
}

export interface AliasStore {
  [profile: string]: {
    [code: string]: string;
  };
}
