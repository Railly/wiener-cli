import type { HorarioBloque } from "../../types/intranet.js";
import { getTodo, getUpcomingEvents } from "../api/canvas/calendar.js";
import { getActiveCourses } from "../api/canvas/courses.js";
import { getHorarioMatriculado } from "../api/intranet/horario.js";
import { loadConfig } from "../env.js";
import type { DeltaItem } from "../state/diff.js";
import { isStateStale, loadState, stateAgeLabel } from "../state/snapshot.js";
import { runNuevo } from "./nuevo-diff.js";

export type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

const DIA_MAP: Record<number, DiaSemana> = {
  0: "D",
  1: "L",
  2: "M",
  3: "X",
  4: "J",
  5: "V",
  6: "S",
};

const DIA_NOMBRES: Record<DiaSemana, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface PendienteItem {
  tipo: "entrega" | "tarea" | "quiz";
  curso: string;
  titulo: string;
  due: Date;
  url: string;
}

export interface EstaSemana {
  tareas_count: number;
  quizzes_count: number;
}

export interface Panorama {
  fecha_label: string;
  ahora: HorarioBloque | null;
  proximo: HorarioBloque | null;
  eta_minutos: number | null;
  pendiente_hoy: PendienteItem[];
  esta_semana: EstaSemana;
  diff_items: DeltaItem[];
  diff_desde_label: string | null;
  authed: boolean;
}

function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function computeAhoraProximo(
  bloques: HorarioBloque[],
  nowMins: number,
): { ahora: HorarioBloque | null; proximo: HorarioBloque | null; eta: number | null } {
  const sorted = [...bloques].sort(
    (a, b) => timeToMinutes(a.time_start) - timeToMinutes(b.time_start),
  );

  let ahora: HorarioBloque | null = null;
  let proximo: HorarioBloque | null = null;
  let eta: number | null = null;

  for (const b of sorted) {
    const start = timeToMinutes(b.time_start);
    const end = timeToMinutes(b.time_end);
    if (nowMins >= start && nowMins < end) {
      ahora = b;
    } else if (nowMins < start) {
      if (!proximo) {
        proximo = b;
        eta = start - nowMins;
      }
    }
  }

  return { ahora, proximo, eta };
}

export async function buildPanorama(
  opts: {
    noUpdateState?: boolean;
    profile?: string;
  } = {},
): Promise<Panorama> {
  const { noUpdateState = false, profile = "default" } = opts;
  const config = loadConfig();

  const now = new Date();
  const diaSemana = DIA_MAP[now.getDay()] ?? "L";
  const diaLabel = DIA_NOMBRES[diaSemana];
  const fecha_label = `${diaLabel} ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`;

  let authed = true;
  let ahoraBloque: HorarioBloque | null = null;
  let proximoBloque: HorarioBloque | null = null;
  let etaMinutos: number | null = null;
  const pendienteHoy: PendienteItem[] = [];
  const estaSemana: EstaSemana = { tareas_count: 0, quizzes_count: 0 };
  let diffItems: DeltaItem[] = [];
  let diffDesdeLabel: string | null = null;

  try {
    const [horario, upcomingEvents, todo] = await Promise.all([
      getHorarioMatriculado(),
      getUpcomingEvents(),
      getTodo(),
    ]);

    const todayBloques = horario.dias[diaSemana] ?? [];
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const computed = computeAhoraProximo(todayBloques, nowMins);
    ahoraBloque = computed.ahora;
    proximoBloque = computed.proximo;
    etaMinutos = computed.eta;

    const courses = await getActiveCourses();
    const courseCodeMap = new Map<number, string>();
    for (const c of courses) {
      for (const s of c.secciones) {
        courseCodeMap.set(s.id, c.code);
      }
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const allEvents = [...upcomingEvents, ...todo.filter((t) => t.assignment)];

    for (const ev of allEvents) {
      const dueAt = ev.assignment?.due_at ?? (ev as { start_at?: string }).start_at;
      if (!dueAt) continue;
      const due = new Date(dueAt);

      const courseIdStr = ev.context_code?.replace("course_", "") ?? "";
      const courseId = Number(courseIdStr);
      const curso = courseCodeMap.get(courseId) ?? courseIdStr;

      const title = ev.assignment?.name ?? (ev as { title?: string }).title ?? "Tarea";

      const submissionTypes = ev.assignment?.submission_types ?? [];
      const isQuiz =
        submissionTypes.some((t) => t === "online_quiz") ||
        (ev as { type?: string }).type === "quiz";
      const tipo: PendienteItem["tipo"] = isQuiz
        ? "quiz"
        : due <= todayEnd && due >= now && todayEnd.getTime() - due.getTime() < 6 * 3600 * 1000
          ? "entrega"
          : "tarea";

      if (due >= now && due <= todayEnd) {
        pendienteHoy.push({
          tipo,
          curso,
          titulo: title,
          due,
          url: ev.html_url ?? "",
        });
      } else if (due < now) {
        pendienteHoy.push({
          tipo: "entrega",
          curso,
          titulo: title,
          due,
          url: ev.html_url ?? "",
        });
      }

      if (due > todayEnd && due <= weekEnd) {
        if (isQuiz) {
          estaSemana.quizzes_count++;
        } else {
          estaSemana.tareas_count++;
        }
      }
    }

    pendienteHoy.sort((a, b) => a.due.getTime() - b.due.getTime());

    if (config.panorama.show_diff) {
      const prevState = loadState(profile);
      const shouldShowDiff =
        !prevState || !isStateStale(prevState, config.panorama.diff_max_age_hours);

      if (prevState) {
        diffDesdeLabel = stateAgeLabel(prevState);
      }

      const { items } = await runNuevo({ dryRun: noUpdateState, profile });
      if (shouldShowDiff || !prevState) {
        diffItems = items;
      }
    }
  } catch {
    authed = false;
  }

  return {
    fecha_label,
    ahora: ahoraBloque,
    proximo: proximoBloque,
    eta_minutos: etaMinutos,
    pendiente_hoy: pendienteHoy,
    esta_semana: estaSemana,
    diff_items: diffItems,
    diff_desde_label: diffDesdeLabel,
    authed,
  };
}
