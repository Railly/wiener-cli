// wiener calendario --ics [--out PATH] [--curso <ref>]

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";
import { emitNextSteps } from "../../lib/agent/next-steps.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";

async function downloadIcs(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ICS: ${res.status}`);
  return res.text();
}

function mergeIcs(calendars: string[]): string {
  if (calendars.length === 0) return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";

  const allVEvents: string[] = [];

  for (const cal of calendars) {
    const matches = cal.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    allVEvents.push(...matches);
  }

  return `${[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//wiener-cli//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...allVEvents,
    "END:VCALENDAR",
  ].join("\r\n")}\r\n`;
}

function defaultOutPath(): string {
  return join(homedir(), "wiener-calendar.ics");
}

function printIcsSummary(outPath: string, courseCount: number, eventCount: number): void {
  console.log(`\n${pc.cyan("✓")} ${pc.bold("Calendario exportado")}\n`);
  const labelW = 10;
  console.log(
    `  ${pc.dim("Archivo:".padEnd(labelW))} ${pc.bold(outPath.split("/").pop() ?? outPath)}`,
  );
  console.log(`  ${pc.dim("Ruta:".padEnd(labelW))} ${outPath}`);
  console.log(`  ${pc.dim("Cursos:".padEnd(labelW))} ${courseCount}`);
  console.log(`  ${pc.dim("Eventos:".padEnd(labelW))} ${eventCount}`);
}

export async function runCalendarioIcs(opts: {
  json?: boolean;
  out?: string;
  curso?: string;
  exact?: boolean;
  noInput?: boolean;
}): Promise<void> {
  try {
    const courses = await fetchActiveCourses();
    const outPath = opts.out ?? defaultOutPath();

    if (opts.curso) {
      const logical = groupBySection(courses);
      const resolution = resolveCourse(opts.curso, logical, {
        exact: opts.exact,
        noInput: opts.noInput,
      });

      if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
        const errEnv = err("course-not-found", `No course matching "${opts.curso}"`);
        if (opts.json) {
          emit(errEnv);
          return;
        }
        process.stderr.write(`No course matching "${opts.curso}"\n`);
        process.exit(1);
        return;
      }

      const resolvedCourse = resolution.course;
      const matchingCourses = courses.filter((c) => c.course_code === resolvedCourse.code);

      const icsUrls = matchingCourses.map((c) => c.calendar?.ics).filter(Boolean) as string[];
      if (icsUrls.length === 0) {
        const errEnv = err("not-implemented", "No ICS URL available for this course");
        if (opts.json) {
          emit(errEnv);
          return;
        }
        process.stderr.write("No ICS URL for this course\n");
        process.exit(1);
        return;
      }

      const primaryUrl = icsUrls[0] as string;
      const icsContent = await downloadIcs(primaryUrl);
      const eventCount = (icsContent.match(/BEGIN:VEVENT/g) ?? []).length;
      writeFileSync(outPath, icsContent);

      if (opts.json) {
        emit(ok({ ok: true, path: outPath, url: primaryUrl, eventos: eventCount }));
        return;
      }

      printIcsSummary(outPath, 1, eventCount);
      emitNextSteps([
        { command: `open "${outPath}"`, description: "importar en Apple Calendar" },
        {
          command: `wiener calendario --ics -o otro.ics`,
          description: "exportar todo el calendario",
        },
      ]);
      return;
    }

    const icsUrls = courses.map((c) => c.calendar?.ics).filter(Boolean) as string[];
    if (icsUrls.length === 0) {
      const errEnv = err("not-implemented", "No ICS URLs available");
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write("No ICS URLs available for courses\n");
      process.exit(1);
      return;
    }

    const calendars = await Promise.all(icsUrls.map(downloadIcs));
    const merged = mergeIcs(calendars);
    writeFileSync(outPath, merged);

    const eventCount = (merged.match(/BEGIN:VEVENT/g) ?? []).length;

    if (opts.json) {
      emit(ok({ ok: true, path: outPath, courses: courses.length, eventos: eventCount }));
      return;
    }

    printIcsSummary(outPath, courses.length, eventCount);

    emitNextSteps([
      {
        command: `open ~/wiener-calendar.ics`,
        description: "importar en Apple Calendar",
      },
      {
        command: "https://calendar.google.com → Configuración → Importar",
        description: "importar en Google Calendar",
        optional: true,
      },
      {
        command: `wiener calendario --ics --curso <ref> -o curso.ics`,
        description: "exportar solo un curso",
        optional: true,
      },
    ]);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
