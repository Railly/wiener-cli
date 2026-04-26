export interface HorarioBloque {
  time_start: string;
  time_end: string;
  course_code: string;
  course_name: string;
  section: string;
  type: string;
  room: string;
  building: string;
  teacher: string;
}

export interface HorarioDia {
  bloques: HorarioBloque[];
}

export interface HorarioWeek {
  semana: string;
  dias: {
    L?: HorarioBloque[];
    M?: HorarioBloque[];
    X?: HorarioBloque[];
    J?: HorarioBloque[];
    V?: HorarioBloque[];
    S?: HorarioBloque[];
    D?: HorarioBloque[];
  };
}
