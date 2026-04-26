import pc from "picocolors";
import type { DeltaItem } from "../state/diff.js";

export interface NuevoRenderOpts {
  color: boolean;
  desde: string | null;
}

const TIPO_ICON: Record<DeltaItem["tipo"], string> = {
  anuncio: "✦",
  archivo: "✦",
  calificacion: "✦",
  tarea: "✦",
  modulo: "✦",
};

const TIPO_LABEL: Record<DeltaItem["tipo"], string> = {
  anuncio: "anuncio",
  archivo: "archivo",
  calificacion: "calificación",
  tarea: "tarea",
  modulo: "módulo",
};

export function renderNuevo(items: DeltaItem[], opts: NuevoRenderOpts): string {
  const { color, desde } = opts;
  const lines: string[] = [];

  if (items.length === 0) {
    const msg = "Sin cambios desde la última corrida.";
    lines.push(color ? pc.green(msg) : msg);
    return lines.join("\n");
  }

  if (desde) {
    const d = new Date(desde);
    const fmt = d.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const header = `Cambios desde ${fmt}`;
    lines.push(color ? pc.bold(header) : header);
    lines.push(color ? pc.dim("─".repeat(header.length)) : "─".repeat(header.length));
  }
  lines.push("");

  for (const item of items) {
    const icon = color ? pc.cyan(TIPO_ICON[item.tipo]) : TIPO_ICON[item.tipo];
    const tipo = color ? pc.dim(TIPO_LABEL[item.tipo]) : TIPO_LABEL[item.tipo];
    const curso = color ? pc.dim(item.curso) : item.curso;
    const titulo = color ? pc.bold(item.titulo) : item.titulo;
    const detalle = item.detalle ? (color ? pc.dim(`  ${item.detalle}`) : `  ${item.detalle}`) : "";
    lines.push(`  ${icon} ${tipo}  ${curso}  ${titulo}${detalle}`);
  }

  lines.push("");
  const hint = "  wiener nuevo --abrir   para abrir en browser";
  lines.push(color ? pc.dim(hint) : hint);

  return lines.join("\n");
}
