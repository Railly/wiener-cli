export interface IntranetSession {
  aspCookieName: string;
  aspCookieValue: string;
  perfil: "A" | "D" | "P";
  codigo: string;
  capturedAt: string;
}

export interface IntranetAuthResult {
  ok: boolean;
  perfil: "A" | "D" | "P";
  codigo: string;
  expiresAt?: string;
}

export interface AuthenticateResponse {
  estado: string;
  action: string;
  mensaje?: string;
}

export interface TramiteItem {
  id: string;
  tipo: string;
  estado: string;
  fecha_inicio: string | null;
}

export interface TramiteData {
  tramites: TramiteItem[];
}

export type DiaCode = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface HorarioData {
  semana: string;
  dias: Record<DiaCode, HorarioBloque[]>;
}

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
