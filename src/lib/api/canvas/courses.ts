// PHASE C WILL REPLACE — stub for Phase D
import type { LogicalCourse } from "../../../types/course.js";

export async function getActiveCourses(): Promise<LogicalCourse[]> {
  return [
    {
      code: "AC6M28",
      name: "CIENCIA Y DESCUBRIMIENTO",
      alias: "ciencia",
      secciones: [{ id: 131067, seccion: "T", name: "CIENCIA Y DESCUBRIMIENTO - T" }],
      term: "2026-I",
      role: "student",
    },
    {
      code: "FB6M4",
      name: "LABORATORIO Y DIAGNÓSTICO II",
      alias: "laboratorio",
      secciones: [
        { id: 131068, seccion: "T", name: "LABORATORIO Y DIAGNÓSTICO II - T" },
        { id: 131069, seccion: "PD", name: "LABORATORIO Y DIAGNÓSTICO II - PD" },
      ],
      term: "2026-I",
      role: "student",
    },
    {
      code: "FB6N1",
      name: "TERAPÉUTICA FARMACOLÓGICA III",
      alias: "terapeutica",
      secciones: [
        { id: 131070, seccion: "T", name: "TERAPÉUTICA FARMACOLÓGICA III - T" },
        { id: 131071, seccion: "P1", name: "TERAPÉUTICA FARMACOLÓGICA III - P1" },
      ],
      term: "2026-I",
      role: "student",
    },
    {
      code: "FB6N2",
      name: "FARMACIA CLÍNICA I",
      alias: "farmacia",
      secciones: [{ id: 131072, seccion: "T", name: "FARMACIA CLÍNICA I - T" }],
      term: "2026-I",
      role: "student",
    },
  ];
}
