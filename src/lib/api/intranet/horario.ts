// PHASE B WILL REPLACE — stub for Phase D
import type { HorarioWeek } from "../../../types/intranet.js";

export async function getHorarioMatriculado(): Promise<HorarioWeek> {
  return {
    semana: "2026-I",
    dias: {
      L: [
        {
          time_start: "07:00",
          time_end: "10:00",
          course_code: "AC6M28",
          course_name: "CIENCIA Y DESCUBRIMIENTO",
          section: "T",
          type: "Remoto-Videoconf",
          room: "Virtual",
          building: "Online",
          teacher: "Pérez, {REDACTED_NAME}",
        },
        {
          time_start: "11:30",
          time_end: "14:00",
          course_code: "FB6M4",
          course_name: "LABORATORIO Y DIAGNÓSTICO II",
          section: "PD",
          type: "Presencial",
          room: "Aula 305",
          building: "Pabellón B",
          teacher: "García, Luis",
        },
      ],
      M: [],
      X: [
        {
          time_start: "08:00",
          time_end: "11:00",
          course_code: "FB6N1",
          course_name: "TERAPÉUTICA FARMACOLÓGICA III",
          section: "T",
          type: "Presencial",
          room: "Aula 201",
          building: "Pabellón A",
          teacher: "Vargas, Carmen",
        },
      ],
      J: [],
      V: [],
    },
  };
}
