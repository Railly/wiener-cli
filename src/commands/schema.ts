import type { Command } from "commander";
import { ok } from "../lib/output/envelope.js";
import { printTable } from "../lib/output/human.js";
import { emitJson } from "../lib/output/json.js";

const COMMANDS = [
  "auth login",
  "auth status",
  "auth logout",
  "auth canvas set-token",
  "auth canvas pat new",
  "auth canvas clear",
  "cursos",
  "cursos info",
  "cursos abrir",
  "cursos aliases",
  "cursos aliases list",
  "cursos aliases reset",
  "cursos favoritos",
  "doctor",
  "schema",
  "config show",
  "config path",
  // Stubbed (phases B/C/D/E)
  "tareas",
  "tareas hoy",
  "tareas semana",
  "tareas info",
  "planner",
  "calificaciones",
  "notas",
  "horario",
  "asistencia",
  "plan",
  "examenes",
  "matricula",
  "perfil",
  "pagos",
  "tramite",
  "anuncios",
  "archivos",
  "modulos",
  "syllabus",
  "paginas",
  "discusiones",
  "quizzes",
  "conferencias",
  "calendario",
  "inbox",
  "hoy",
  "ahora",
  "semana",
  "nuevo",
  "watch",
];

const SCHEMAS: Record<
  string,
  { args?: Record<string, string>; output_schema: Record<string, unknown> }
> = {
  "auth login": {
    output_schema: { ok: "boolean", perfil: "string", codigo: "string", expiresAt: "string?" },
  },
  "auth status": {
    output_schema: {
      intranet: {
        authed: "boolean",
        codigo: "string?",
        perfil: "string?",
        sessionAgeMinutes: "number?",
      },
      canvas: {
        authed: "boolean",
        tokenSet: "boolean",
        userId: "string?",
        primaryEmail: "string?",
      },
    },
  },
  "auth canvas set-token": {
    args: { pat: "string" },
    output_schema: { ok: "boolean", user: { id: "string", name: "string" } },
  },
  cursos: {
    output_schema: {
      cursos: [
        {
          code: "string",
          name: "string",
          alias: "string",
          secciones: [{ id: "string", seccion: "string", name: "string" }],
          term: "string?",
          role: "string?",
        },
      ],
    },
  },
  doctor: {
    output_schema: { ok: "boolean", checks: [{ name: "string", ok: "boolean", detail: "string" }] },
  },
};

interface SchemaOptions {
  json?: boolean;
  list?: boolean;
}

export function registerSchema(program: Command): void {
  program
    .command("schema [command]")
    .description("Show JSON schema for a command (use --list to list all commands)")
    .option("--json", "Output JSON envelope")
    .option("--list", "List all available commands")
    .action((commandArg: string | undefined, opts: SchemaOptions) => {
      if (opts.list || !commandArg) {
        const data = { commands: COMMANDS };
        if (opts.json) emitJson(ok(data));
        printTable(
          COMMANDS.map((c) => ({ command: c })),
          [{ header: "Command", key: "command" }],
        );
        process.exit(0);
      }

      const schema = SCHEMAS[commandArg];
      const data = {
        command: commandArg,
        args: schema?.args ?? {},
        output_schema: schema?.output_schema ?? {},
        envelope: {
          ok: "boolean",
          data: "command-specific",
          meta: { duration_ms: "number?", rate_limit_remaining: "number?", from_cache: "boolean?" },
        },
      };

      if (opts.json) emitJson(ok(data));
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    });
}
