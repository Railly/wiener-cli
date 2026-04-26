import type { Command } from "commander";
import { NotImplementedError } from "../lib/errors.js";
import { err } from "../lib/output/envelope.js";
import { printError } from "../lib/output/human.js";
import { emitJson } from "../lib/output/json.js";

function notImplAction(name: string, jsonFlag: () => boolean) {
  return () => {
    const e = new NotImplementedError(name);
    if (jsonFlag()) {
      emitJson(err(e.code, e.message, e.hint));
    }
    printError(e.code, e.message, e.hint);
    process.exit(1);
  };
}

export function registerStubs(program: Command): void {
  let jsonMode = false;
  program.on("option:json", () => {
    jsonMode = true;
  });

  const makeStub = (name: string, description: string) => {
    const parts = name.split(" ");
    const cmdName = parts[parts.length - 1] ?? name;
    return { cmdName, description, action: notImplAction(name, () => jsonMode) };
  };

  const stubs = [
    makeStub("hoy", "Today's schedule and tasks"),
    makeStub("ahora", "Current and upcoming class"),
    makeStub("semana", "Weekly schedule, tasks, quizzes"),
    makeStub("nuevo", "Diff since last run (announcements, files, grades)"),
    makeStub("watch", "Background change monitor with macOS notifications"),
    makeStub("notas", "Official grades from intranet"),
    makeStub("historial", "Academic history from intranet"),
    makeStub("horario", "Class schedule from intranet"),
    makeStub("asistencia", "Attendance records"),
    makeStub("plan", "Study plan and progress"),
    makeStub("examenes", "Upcoming exams schedule"),
    makeStub("matricula", "Current enrollment"),
    makeStub("perfil", "Student profile data"),
    makeStub("pagos", "Pending payments and obligations"),
    makeStub("tramite", "Active procedures"),
    makeStub("tareas", "Assignments across all courses"),
    makeStub("planner", "Canvas planner items"),
    makeStub("calificaciones", "Grades from Canvas"),
    makeStub("anuncios", "Course announcements (Canvas)"),
    makeStub("archivos", "Course files (Canvas)"),
    makeStub("modulos", "Course modules (Canvas)"),
    makeStub("syllabus", "Course syllabus"),
    makeStub("paginas", "Course wiki pages"),
    makeStub("discusiones", "Discussion topics"),
    makeStub("quizzes", "Quizzes"),
    makeStub("conferencias", "Recorded conferences"),
    makeStub("calendario", "Calendar events"),
    makeStub("inbox", "Canvas inbox"),
  ];

  for (const { cmdName, description, action } of stubs) {
    program
      .command(`${cmdName} [args...]`, { hidden: false })
      .description(`${description} (not yet implemented)`)
      .allowUnknownOption(true)
      .action(action);
  }
}
