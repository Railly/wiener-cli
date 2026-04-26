import type { Command } from "commander";
import pc from "picocolors";
import { ok } from "../lib/output/envelope.js";
import { printTable } from "../lib/output/human.js";
import { emitJson } from "../lib/output/json.js";

type CommandGroup = "auth" | "day" | "academic" | "materials" | "ops";

const COMMANDS_BY_GROUP: Record<CommandGroup, string[]> = {
  auth: [
    "auth login",
    "auth logout",
    "auth status",
    "auth canvas set-token",
    "auth canvas pat new",
    "auth canvas clear",
  ],
  day: ["hoy", "ahora", "semana", "nuevo", "planner"],
  academic: [
    "notas",
    "horario",
    "asistencia",
    "historial",
    "examenes",
    "matricula",
    "plan",
    "perfil",
    "pagos",
    "tramite",
    "tramite generar",
    "tareas",
    "tareas hoy",
    "tareas semana",
    "tareas info",
    "tareas submit",
    "calificaciones",
    "calendario",
    "inbox",
    "inbox info",
  ],
  materials: [
    "cursos",
    "cursos info",
    "cursos abrir",
    "cursos favoritos",
    "cursos aliases",
    "cursos aliases list",
    "cursos aliases reset",
    "archivos",
    "archivos arbol",
    "archivos download",
    "archivos sync",
    "anuncios",
    "modulos",
    "syllabus",
    "paginas",
    "discusiones",
    "quizzes",
    "conferencias",
  ],
  ops: ["doctor", "schema", "config show", "config path", "watch"],
};

const COMMANDS = Object.values(COMMANDS_BY_GROUP).flat();

const GROUP_LABELS: Record<CommandGroup, string> = {
  auth: "Auth",
  day: "Día",
  academic: "Académico",
  materials: "Materiales",
  ops: "Operaciones",
};

const SCHEMAS: Record<
  string,
  {
    description: string;
    args?: Record<string, string>;
    options?: Record<string, string>;
    returns?: Record<string, string>;
    trust?: string;
  }
> = {
  "auth login": {
    description: "Autenticar con el portal intranet",
    options: { "--usuario <u>": "Código de alumno", "--pass <p>": "Contraseña", "--perfil <A|D|P>": "Perfil" },
    returns: { "ok": "boolean", "perfil": "string", "codigo": "string", "expiresAt": "string?" },
    trust: "T0",
  },
  "auth status": {
    description: "Ver estado de ambas sesiones (intranet + Canvas)",
    returns: {
      "intranet.authed": "boolean",
      "intranet.codigo": "string?",
      "canvas.authed": "boolean",
      "canvas.userId": "string?",
    },
    trust: "T0",
  },
  "auth canvas set-token": {
    description: "Registrar un PAT de Canvas",
    args: { "pat": "string" },
    returns: { "ok": "boolean", "user.id": "string", "user.name": "string" },
    trust: "T0",
  },
  cursos: {
    description: "Listar cursos activos del periodo",
    returns: { "cursos": "array [{ code, name, alias, secciones[], term?, role? }]" },
    trust: "T0",
  },
  notas: {
    description: "Notas oficiales del periodo actual (intranet)",
    options: { "--periodo <code>": "ID del periodo (default: actual)" },
    returns: {
      "periodo": "string — ej. \"2026-I\"",
      "alumno": "object { codigo, carrera, ciclo, nombre }",
      "ponderado_acumulado": "number",
      "ponderado_historico": "number",
      "cursos": "array [{ codigo, nombre, ciclo, creditos, nota_final, estado, modalidad }]",
    },
    trust: "T0",
  },
  tareas: {
    description: "Tareas y assignments de Canvas",
    args: { "[ref]": "Referencia de curso (opcional)" },
    returns: { "tareas": "array [{ id, name, due_at, points_possible, submitted, curso }]" },
    trust: "T0",
  },
  "tareas submit": {
    description: "Entregar una tarea a Canvas (requiere confirmación)",
    args: { "ref": "Referencia de curso", "assignment-ref": "ID o nombre de tarea", "[files...]": "Archivos a subir" },
    options: { "--type <type>": "online_upload|online_text_entry|online_url|auto", "--yes": "Skip prompt" },
    returns: { "ok": "boolean", "submission.submitted_at": "string", "submission.attempt": "number" },
    trust: "T2",
  },
  doctor: {
    description: "Diagnóstico de salud del CLI",
    returns: { "ok": "boolean", "checks": "array [{ name, ok, status, detail }]" },
    trust: "T0",
  },
  inbox: {
    description: "Mensajes Canvas (bandeja de entrada)",
    options: { "--no-leidos": "Solo no leídos", "--limit <n>": "Máx filas (default: 20)" },
    returns: { "total": "number", "unread": "number", "conversaciones": "array [{ id, from, subject, unread, count }]" },
    trust: "T0",
  },
  calendario: {
    description: "Calendario de eventos y tareas Canvas",
    options: { "--dias <n>": "Días a mostrar (default: 7)", "--ics": "Exportar ICS", "--out <path>": "Ruta de salida" },
    returns: { "eventos": "array [{ fecha, tipo, titulo, curso, url }]", "dias": "number" },
    trust: "T0",
  },
  "archivos download": {
    description: "Descargar un archivo Canvas (T2 para >50 MB)",
    args: { "file-id": "Canvas file ID" },
    options: { "--out <path>": "Ruta destino", "--force": "Sobreescribir", "--yes": "Skip prompt" },
    returns: { "ok": "boolean", "path": "string", "size": "number", "duration_ms": "number" },
    trust: "T0/T2",
  },
  "archivos sync": {
    description: "Sync todos los archivos de un curso (T2)",
    args: { "course-id": "Canvas course ID o ref" },
    options: { "--dir <path>": "Directorio destino", "--max-size <mb>": "Límite MB" },
    returns: { "ok": "boolean", "total": "number", "downloaded": "number", "skipped": "number", "failed": "number" },
    trust: "T2",
  },
};

interface SchemaOptions {
  json?: boolean;
  list?: boolean;
}

function printHumanSchema(commandArg: string): void {
  const schema = SCHEMAS[commandArg];

  console.log(`\n${pc.bold("Comando:")} ${pc.cyan(`wiener ${commandArg}`)}`);
  if (schema?.description) {
    console.log(`${pc.bold("Descripción:")} ${schema.description}`);
  }
  console.log();

  if (schema?.args && Object.keys(schema.args).length > 0) {
    console.log(pc.bold("Argumentos"));
    for (const [arg, desc] of Object.entries(schema.args)) {
      console.log(`  ${pc.cyan(arg.padEnd(28))}  ${pc.dim(desc)}`);
    }
    console.log();
  }

  if (schema?.options && Object.keys(schema.options).length > 0) {
    console.log(pc.bold("Opciones"));
    for (const [flag, desc] of Object.entries(schema.options)) {
      console.log(`  ${pc.cyan(flag.padEnd(28))}  ${pc.dim(desc)}`);
    }
    console.log();
  }

  if (schema?.returns && Object.keys(schema.returns).length > 0) {
    console.log(pc.bold("Retorna"));
    for (const [field, type] of Object.entries(schema.returns)) {
      console.log(`  ${field.padEnd(30)}  ${pc.dim(type)}`);
    }
    console.log();
  }

  if (schema?.trust) {
    console.log(`${pc.bold("Trust:")} ${schema.trust === "T2" ? pc.yellow(schema.trust) : pc.green(schema.trust)} ${pc.dim(schema.trust === "T2" ? "(escritura, requiere confirmación)" : "(lectura, sin confirmación)")}`);
    console.log();
  }

  if (!schema) {
    console.log(pc.dim(`Schema no disponible para "wiener ${commandArg}". Usa --list para ver todos.`));
    console.log();
  }
}

export function registerSchema(program: Command): void {
  program
    .command("schema [command]")
    .description("Show schema for a command (human-readable by default, --json for agents)")
    .option("--json", "Output raw JSON schema (for agents)")
    .option("--list", "List all available commands grouped by section")
    .action((commandArg: string | undefined, opts: SchemaOptions) => {
      if (opts.list || !commandArg) {
        if (opts.json) {
          emitJson(ok({ commands: COMMANDS }));
          process.exit(0);
        }

        console.log(`\n${pc.bold("Comandos disponibles — wiener-cli")}\n`);
        for (const [group, cmds] of Object.entries(COMMANDS_BY_GROUP) as [CommandGroup, string[]][]) {
          console.log(pc.bold(`${GROUP_LABELS[group]}`));
          for (const cmd of cmds) {
            const schema = SCHEMAS[cmd];
            const desc = schema?.description ?? "";
            console.log(`  ${pc.cyan(`wiener ${cmd}`.padEnd(32))}  ${pc.dim(desc)}`);
          }
          console.log();
        }

        process.exit(0);
      }

      const schema = SCHEMAS[commandArg];
      const data = {
        command: commandArg,
        description: schema?.description,
        args: schema?.args ?? {},
        options: schema?.options ?? {},
        returns: schema?.returns ?? {},
        trust: schema?.trust,
        envelope: {
          ok: "boolean",
          data: "command-specific",
          meta: { duration_ms: "number?", rate_limit_remaining: "number?", from_cache: "boolean?" },
        },
      };

      if (opts.json) {
        emitJson(ok(data));
        process.exit(0);
      }

      printHumanSchema(commandArg);

      console.log(pc.dim("→ wiener schema --list") + pc.dim("                  todos los comandos"));
      console.log(pc.dim(`→ wiener schema --json ${commandArg}`) + pc.dim("         schema crudo (para agentes)"));
      console.log();

      process.exit(0);
    });
}
