// PHASE A WILL REPLACE — stub; shape matches Phase A contract

export interface IntranetSession {
  aspCookieName: string;
  aspCookieValue: string;
  perfil: string;
  capturedAt: string;
  codigo?: string;
}

export interface NotaCurso {
  codigo: string;
  nombre: string;
  ciclo: string;
  creditos: number;
  nota_final: number | null;
  estado: string;
  modalidad: string;
}

export interface NotasData {
  periodo: string;
  alumno: {
    codigo: string;
    carrera: string;
    ciclo: string;
  };
  ponderado_acumulado: number | null;
  ponderado_historico: number | null;
  orden_merito: number | null;
  cursos: NotaCurso[];
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
  attribute: string;
  teacher: string;
}

export type DiaCode = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export interface HorarioData {
  semana: string;
  dias: Record<DiaCode, HorarioBloque[]>;
}

export interface AsistenciaCurso {
  codigo: string;
  nombre: string;
  total_clases: number;
  asistencias: number;
  faltas: number;
  tardanzas: number;
  porcentaje: number;
}

export interface AsistenciaData {
  cursos: AsistenciaCurso[];
}

export interface PlanCurso {
  codigo: string;
  nombre: string;
  creditos: number;
  tipo: string;
  estado?: string;
}

export interface PlanCiclo {
  ciclo: string;
  cursos: PlanCurso[];
}

export interface PlanData {
  carrera: string;
  ciclos: PlanCiclo[];
}

export interface PlanAvanceData {
  creditos_aprobados: number;
  creditos_total: number;
  cursos_aprobados: number;
  cursos_pendientes: number;
  porcentaje: number;
}

export interface HistorialCurso {
  codigo: string;
  nombre: string;
  creditos: number;
  nota_final: number | null;
  estado: string;
}

export interface HistorialCiclo {
  periodo: string;
  cursos: HistorialCurso[];
}

export interface HistorialData {
  ciclos: HistorialCiclo[];
}

export interface ExamenItem {
  fecha: string;
  hora: string;
  curso: string;
  modalidad: string;
  aula: string;
}

export interface ExamenesData {
  examenes: ExamenItem[];
}

export interface MatriculaCurso {
  codigo: string;
  nombre: string;
  creditos: number;
  seccion: string;
  modalidad: string;
}

export interface MatriculaData {
  periodo: string;
  ciclo: string;
  cursos: MatriculaCurso[];
}

export interface PerfilData {
  codigo: string;
  nombres: string;
  apellidos: string;
  dni: string;
  carrera: string;
  facultad?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciclo?: string;
}

export interface PagoItem {
  concepto: string;
  monto: number;
  vencimiento: string | null;
  estado: string;
}

export interface PagosData {
  total_pendiente: number;
  items: PagoItem[];
}

export interface PagoHistorialItem {
  concepto: string;
  monto: number;
  fecha_pago: string | null;
  comprobante?: string;
}

export interface PagosHistorialData {
  pagos: PagoHistorialItem[];
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
