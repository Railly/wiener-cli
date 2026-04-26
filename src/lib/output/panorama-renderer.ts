import pc from "picocolors";
import type { Panorama, PendienteItem } from "../workflows/panorama.js";

function ruler(label: string, color: boolean): string {
  if (!color) return `\n${label}\n${"─".repeat(label.length)}`;
  return `\n${pc.bold(label)}\n${pc.dim("─".repeat(label.length))}`;
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDue(due: Date, color: boolean): string {
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeStr = formatTime(due);

  if (diffMs < 0) {
    const label = `venc. ${timeStr} (atrasada)`;
    return color ? pc.red(label) : label;
  }

  if (due <= todayEnd) {
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const eta = hrs > 0 ? `en ${hrs}h` : `en ${mins}m`;
    const label = `venc. ${timeStr} (${eta})`;
    if (diffMs < 6 * 3600 * 1000) {
      return color ? pc.red(label) : label;
    }
    return label;
  }

  if (due < new Date(now.getTime() + 24 * 3600 * 1000)) {
    const label = `venc. mañana ${timeStr}`;
    return color ? pc.yellow(label) : label;
  }

  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  return `venc. en ${days}d`;
}

function renderBloque(
  label: string,
  bloque: NonNullable<Panorama["ahora"]>,
  eta: number | null,
  color: boolean
): string {
  const typeRoom = [bloque.type, bloque.room].filter(Boolean).join(" · ");
  const etaStr = eta !== null ? ` (en ${Math.floor(eta / 60)}h ${eta % 60}m)` : "";
  const coursePart = `${bloque.course_code} · ${bloque.course_name}`;
  const timePart = `${bloque.time_start} - ${bloque.time_end} · ${typeRoom} · Prof. ${bloque.teacher}`;

  const labelPad = padRight(label, 12);
  const separator = "─ ";

  if (!color) {
    return `  ${labelPad}${separator}${coursePart}${etaStr}\n${" ".repeat(14 + 2)}${timePart}`;
  }

  return `  ${pc.dim(labelPad)}${separator}${pc.bold(coursePart)}${color ? pc.yellow(etaStr) : etaStr}\n${" ".repeat(16)}${pc.dim(timePart)}`;
}

function renderPendienteItem(item: PendienteItem, color: boolean): string {
  const pad = padRight("", 2);
  const dueStr = formatDue(item.due, color);

  if (item.tipo === "entrega") {
    const icon = "⚡ ENTREGA";
    const label = color ? pc.red(padRight(icon, 12)) : padRight(icon, 12);
    const curso = color ? pc.dim(padRight(item.curso, 8)) : padRight(item.curso, 8);
    const title = color ? pc.bold(item.titulo) : item.titulo;
    return `${pad}${label}  ${curso}  ${title}  ${" ".repeat(Math.max(0, 30 - item.titulo.length))}${dueStr}`;
  }

  const icon = `○ ${item.tipo}`;
  const label = padRight(icon, 12);
  const curso = color ? pc.dim(padRight(item.curso, 8)) : padRight(item.curso, 8);
  const title = color ? item.titulo : item.titulo;
  return `${pad}${label}  ${curso}  ${title}  ${" ".repeat(Math.max(0, 30 - item.titulo.length))}${dueStr}`;
}

export function renderPanorama(panorama: Panorama, opts: { color: boolean }): string {
  const { color } = opts;
  const lines: string[] = [];

  const header = `Hoy — ${panorama.fecha_label}`;
  lines.push("");
  lines.push(color ? pc.bold(header) : header);
  lines.push(color ? pc.dim("─".repeat(header.length)) : "─".repeat(header.length));

  if (!panorama.authed) {
    lines.push("");
    const msg = "  No autenticado. Configura tus credenciales:";
    lines.push(color ? pc.yellow(msg) : msg);
    lines.push("");
    lines.push("    wiener auth login             — intranet");
    lines.push("    wiener auth canvas pat new    — Canvas PAT");
    return lines.join("\n");
  }

  lines.push("");
  if (panorama.ahora) {
    lines.push(renderBloque("Ahora", panorama.ahora, null, color));
  } else {
    const noClass = "  Ahora        — sin clase";
    lines.push(color ? pc.dim(noClass) : noClass);
  }

  lines.push("");
  if (panorama.proximo) {
    lines.push(renderBloque("Próximo", panorama.proximo, panorama.eta_minutos, color));
  } else {
    const noNext = "  Próximo      — sin más clases hoy";
    lines.push(color ? pc.dim(noNext) : noNext);
  }

  lines.push(ruler("Pendiente hoy", color));
  lines.push("");

  if (panorama.pendiente_hoy.length === 0) {
    lines.push(color ? pc.green("  Nada pendiente hoy.") : "  Nada pendiente hoy.");
  } else {
    for (const item of panorama.pendiente_hoy) {
      lines.push(renderPendienteItem(item, color));
    }
  }

  lines.push(ruler("Esta semana", color));
  lines.push("");
  const { tareas_count, quizzes_count } = panorama.esta_semana;
  if (tareas_count > 0) {
    lines.push(
      `  ${tareas_count} tarea${tareas_count !== 1 ? "s" : ""} más con vencimiento  ${color ? pc.dim("(ver: wiener tareas semana)") : "(ver: wiener tareas semana)"}`
    );
  }
  if (quizzes_count > 0) {
    lines.push(
      `  ${quizzes_count} quiz${quizzes_count !== 1 ? "zes" : ""}  ${color ? pc.dim("(ver: wiener quizzes)") : "(ver: wiener quizzes)"}`
    );
  }
  if (tareas_count === 0 && quizzes_count === 0) {
    lines.push(color ? pc.green("  Sin vencimientos esta semana.") : "  Sin vencimientos esta semana.");
  }

  if (panorama.diff_items.length > 0) {
    const desdeLabel = panorama.diff_desde_label
      ? `(${panorama.diff_desde_label})`
      : "";
    lines.push(ruler(`Cambios desde tu última corrida ${desdeLabel}`, color));
    lines.push("");
    for (const item of panorama.diff_items) {
      const tipoLabel = {
        calificacion: "Nueva calificación",
        anuncio: "Nuevo anuncio",
        archivo: "Nuevo archivo",
        tarea: "Nueva tarea",
        modulo: "Nuevos módulos",
      }[item.tipo];
      const icon = "✦";
      const left = padRight(`${icon} ${tipoLabel}`, 24);
      const right = item.detalle
        ? `${item.curso} ${item.titulo}: ${item.detalle}`
        : `${item.curso} ${item.titulo}`;
      if (color) {
        lines.push(`  ${pc.cyan(left)}  ${right}`);
      } else {
        lines.push(`  ${left}  ${right}`);
      }
    }
    lines.push("");
    const hint = "  → wiener nuevo --abrir   para ver detalles";
    lines.push(color ? pc.dim(hint) : hint);
  }

  lines.push("");
  return lines.join("\n");
}
