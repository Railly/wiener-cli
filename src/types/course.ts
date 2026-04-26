export interface CourseSection {
  id: number;
  seccion: string;
  name: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  alias: string;
  secciones: CourseSection[];
  term?: string;
  role?: string;
}

export interface LogicalCourse {
  code: string;
  name: string;
  alias: string;
  secciones: CourseSection[];
  term?: string;
  role?: string;
}
