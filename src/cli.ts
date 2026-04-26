import { Command } from "commander";
import { makeNotasCommand } from "./commands/notas/list.ts";
import { makeHorarioCommand } from "./commands/horario/week.ts";
import { makeHorarioHoyCommand } from "./commands/horario/hoy.ts";
import { makeHorarioAhoraCommand } from "./commands/horario/ahora.ts";
import { makeAsistenciaCommand } from "./commands/asistencia.ts";
import { makePlanCommand } from "./commands/plan/list.ts";
import { makeHistorialCommand } from "./commands/historial.ts";
import { makeExamenesCommand } from "./commands/examenes.ts";
import { makeMatriculaCommand } from "./commands/matricula.ts";
import { makePerfilCommand } from "./commands/perfil.ts";
import { makePagosCommand } from "./commands/pagos/list.ts";
import { makeTramiteCommand } from "./commands/tramite/list.ts";

const program = new Command();

program
  .name("wiener")
  .description("Agent-first CLI for Universidad Norbert Wiener student portals")
  .version("0.1.0");

// Intranet read commands
const notasCmd = makeNotasCommand();
const horarioCmd = makeHorarioCommand();
horarioCmd.addCommand(makeHorarioHoyCommand());
horarioCmd.addCommand(makeHorarioAhoraCommand());

program.addCommand(notasCmd);
program.addCommand(horarioCmd);
program.addCommand(makeAsistenciaCommand());
program.addCommand(makePlanCommand());
program.addCommand(makeHistorialCommand());
program.addCommand(makeExamenesCommand());
program.addCommand(makeMatriculaCommand());
program.addCommand(makePerfilCommand());
program.addCommand(makePagosCommand());
program.addCommand(makeTramiteCommand());

// Mirror namespace: wiener intranet <name>
const intranetNs = new Command("intranet").description(
  "Mirror namespace for intranet commands (same as top-level)",
);
intranetNs.addCommand(makeNotasCommand());
const horarioCopy = makeHorarioCommand();
horarioCopy.addCommand(makeHorarioHoyCommand());
horarioCopy.addCommand(makeHorarioAhoraCommand());
intranetNs.addCommand(horarioCopy);
intranetNs.addCommand(makeAsistenciaCommand());
intranetNs.addCommand(makePlanCommand());
intranetNs.addCommand(makeHistorialCommand());
intranetNs.addCommand(makeExamenesCommand());
intranetNs.addCommand(makeMatriculaCommand());
intranetNs.addCommand(makePerfilCommand());
intranetNs.addCommand(makePagosCommand());
intranetNs.addCommand(makeTramiteCommand());
program.addCommand(intranetNs);

program.parse(process.argv);
