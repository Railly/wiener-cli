import { mkdirSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { emitNextSteps } from "../lib/agent/next-steps.js";
import { getSelf } from "../lib/api/canvas/users.js";
import { loadCanvasSession, loadIntranetSession } from "../lib/auth/store.js";
import type { CapabilityMap, CapabilityStatus } from "../lib/canvas/probe-capabilities.js";
import { probeCapabilities } from "../lib/canvas/probe-capabilities.js";
import { getProfileDir } from "../lib/env.js";
import type { WienerError } from "../lib/errors.js";
import { ok } from "../lib/output/envelope.js";
import { emitJson } from "../lib/output/json.js";
import { extractCsrfToken } from "../lib/parsers/csrf-token.js";
import { isCi, isWsl } from "../lib/platform/detect.js";
import { VERSION } from "../lib/version.js";

type CheckStatus = "ok" | "warn" | "fail" | "skip";

interface DoctorCheck {
  name: string;
  label: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
  action?: string;
}

interface DoctorOptions {
  json?: boolean;
  profile?: string;
  check?: boolean;
}

async function checkReachable(url: string, name: string, label: string): Promise<DoctorCheck> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    const ms = Date.now() - start;
    const reachable = resp.ok || resp.status < 500;
    return {
      name,
      label,
      status: reachable ? "ok" : "warn",
      detail: reachable ? `reachable (${ms}ms)` : `HTTP ${resp.status}`,
    };
  } catch (e) {
    return {
      name,
      label,
      status: "fail",
      detail: String(e),
    };
  }
}

async function checkIntranetSession(profile: string): Promise<DoctorCheck> {
  const session = await loadIntranetSession(profile);
  if (!session) {
    return {
      name: "intranet-session",
      label: "intranet",
      status: "fail",
      detail: "sesión no encontrada",
      action: "wiener auth login",
    };
  }
  const ageMin = Math.round((Date.now() - new Date(session.capturedAt).getTime()) / 60000);
  return {
    name: "intranet-session",
    label: "intranet",
    status: "ok",
    detail: `authed · perfil ${session.perfil} · sesión ${ageMin}min`,
  };
}

async function checkCanvasPat(profile: string): Promise<DoctorCheck> {
  const session = await loadCanvasSession(profile);
  if (!session) {
    return {
      name: "canvas-pat-valid",
      label: "canvas PAT",
      status: "fail",
      detail: "no configurado",
      action: "wiener auth canvas set-token <pat>",
    };
  }

  try {
    const user = await getSelf(session.token);
    const ageLabel = session.validatedAt
      ? `last call ${Math.round((Date.now() - new Date(session.validatedAt).getTime()) / 3600000)}h ago`
      : "";
    return {
      name: "canvas-pat-valid",
      label: "canvas PAT",
      status: "ok",
      detail: `valid · userId ${user.id}${ageLabel ? ` · ${ageLabel}` : ""}`,
    };
  } catch (e) {
    const wienerErr = e as WienerError;
    return {
      name: "canvas-pat-valid",
      label: "canvas PAT",
      status: "fail",
      detail: wienerErr.message,
      action: "wiener auth canvas pat new",
    };
  }
}

async function checkCsrfToken(): Promise<DoctorCheck> {
  try {
    const resp = await fetch("https://intranet.uwiener.edu.pe/sso.asp", {
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const token = extractCsrfToken(html);
    return {
      name: "csrf-token-stable",
      label: "csrfToken estable",
      status: "ok",
      detail: token.slice(0, 8),
    };
  } catch (e) {
    return {
      name: "csrf-token-stable",
      label: "csrfToken estable",
      status: "fail",
      detail: String(e),
    };
  }
}

async function checkPatGenerationEnabled(profile: string): Promise<DoctorCheck> {
  const session = await loadCanvasSession(profile);
  if (!session) {
    return {
      name: "pat-generation-enabled",
      label: "pat-generation enabled",
      status: "skip",
      detail: "Canvas not configured",
    };
  }

  try {
    const resp = await fetch("https://campus.uwiener.edu.pe/profile/settings", {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const hasLink = html.includes("manageable_access_tokens") || html.includes("New Access Token");
    return {
      name: "pat-generation-enabled",
      label: "pat-generation enabled",
      status: hasLink ? "ok" : "warn",
      detail: hasLink ? "token creation accessible" : "UI not found (may be disabled)",
    };
  } catch (e) {
    return {
      name: "pat-generation-enabled",
      label: "pat-generation enabled",
      status: "fail",
      detail: String(e),
    };
  }
}

function checkRuntimeEnv(): DoctorCheck {
  const bunVersion = process.versions.bun ?? "unknown";
  const cols = process.stdout.columns ?? 0;
  const tty = process.stdout.isTTY ? `sí (${cols} cols)` : "no";
  return {
    name: "runtime-env",
    label: "Bun runtime",
    status: "ok",
    detail: `${bunVersion} · TTY ${tty} · ${platform()}${isCi() ? " · CI" : ""}${isWsl() ? " · WSL" : ""}`,
  };
}

function statusIcon(status: CheckStatus): string {
  if (status === "ok") return pc.green("✓");
  if (status === "warn") return pc.yellow("⚠");
  if (status === "fail") return pc.red("✗");
  return pc.dim("-");
}

function capIcon(status: CapabilityStatus): string {
  if (status === "ok") return pc.green("✓");
  if (status === "restricted") return pc.red("✗");
  if (status === "disabled") return pc.dim("-");
  return pc.yellow("?");
}

function printCapabilities(caps: CapabilityMap): void {
  console.log(pc.bold("Capabilidades de la API Canvas"));

  const rows: Array<{
    label: string;
    status: CapabilityStatus;
    note: string;
    workaround?: string;
  }> = [
    {
      label: "cursos, tareas, calificaciones, módulos",
      status: "ok",
      note: "accesibles",
    },
    {
      label: "anuncios",
      status: caps.anuncios === "ok" ? "ok" : caps.anuncios === "restricted" ? "restricted" : "ok",
      note: caps.anuncios === "restricted" ? "restringido" : "accesible (endpoint global)",
    },
    {
      label: "syllabus (via course details)",
      status: caps.syllabus === "restricted" ? "restricted" : "ok",
      note: caps.syllabus === "restricted" ? "restringido" : "accesible",
    },
    {
      label: "archivos directos (/files)",
      status: caps.files,
      note:
        caps.files === "restricted"
          ? "restringido por Wiener"
          : caps.files === "ok"
            ? "accesible"
            : "desconocido",
      workaround:
        caps.files === "restricted"
          ? "wiener archivos <ref> usa módulos automáticamente"
          : undefined,
    },
    {
      label: "rubrics",
      status: caps.rubrics,
      note:
        caps.rubrics === "restricted"
          ? "restringidos"
          : caps.rubrics === "ok"
            ? "accesibles"
            : "desconocido",
      workaround:
        caps.rubrics === "restricted"
          ? "wiener tareas info omite rubric automáticamente"
          : undefined,
    },
    {
      label: "pages/quizzes/conferences",
      status: "disabled",
      note: "feature deshabilitada (per curso)",
    },
  ];

  for (const row of rows) {
    const icon = capIcon(row.status);
    const label = pad(pc.dim(row.label), 45);
    const noteColor =
      row.status === "restricted"
        ? pc.red(row.note)
        : row.status === "disabled"
          ? pc.dim(row.note)
          : pc.dim(row.note);
    console.log(`  ${icon}  ${label}  ${noteColor}`);
    if (row.workaround) {
      console.log(`     ${pc.dim("→ workaround:")} ${pc.cyan(row.workaround)}`);
    }
  }
  console.log();
}

function stripAnsi(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const code = s.charCodeAt(i);
    if (code === 0x1b && s[i + 1] === "[") {
      i += 2;
      while (i < s.length && !(s.charCodeAt(i) >= 0x40 && s.charCodeAt(i) <= 0x7e)) i++;
      i++;
    } else {
      out += s[i++];
    }
  }
  return out;
}

function pad(s: string, width: number): string {
  const visible = stripAnsi(s);
  const diff = width - visible.length;
  return diff > 0 ? `${s}${" ".repeat(diff)}` : s;
}

function printSection(title: string, checks: DoctorCheck[]): void {
  console.log(pc.bold(title));
  for (const check of checks) {
    const icon = statusIcon(check.status);
    const label = pad(pc.dim(check.label), 30);
    const detail =
      check.status === "fail"
        ? pc.red(check.detail)
        : check.status === "warn"
          ? pc.yellow(check.detail)
          : pc.dim(check.detail);
    console.log(`  ${icon}  ${label}  ${detail}`);
    if ((check.status === "fail" || check.status === "warn") && check.action) {
      console.log(`     ${pc.dim("→")} ${pc.cyan(check.action)}`);
    }
  }
  console.log();
}

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Run health checks on both backends and auth")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--check", "Run live CSRF token check")
    .action(async (opts: DoctorOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";

      const connectivityChecks: DoctorCheck[] = [
        await checkReachable(
          "https://intranet.uwiener.edu.pe/sso.asp",
          "intranet-reachable",
          "intranet.uwiener.edu.pe",
        ),
        await checkReachable(
          "https://campus.uwiener.edu.pe/api/v1/users/self",
          "canvas-reachable",
          "campus.uwiener.edu.pe",
        ),
      ];

      const sessionChecks: DoctorCheck[] = [
        await checkIntranetSession(profile),
        await checkCanvasPat(profile),
      ];

      const healthChecks: DoctorCheck[] = [];
      if (opts.check) {
        healthChecks.push(await checkCsrfToken());
      }
      healthChecks.push(await checkPatGenerationEnabled(profile));

      const envChecks: DoctorCheck[] = [checkRuntimeEnv()];

      const allChecks = [...connectivityChecks, ...sessionChecks, ...healthChecks, ...envChecks];
      const allOk = allChecks.every((c) => c.status === "ok" || c.status === "skip");

      let capabilities: CapabilityMap | null = null;
      const canvasConfigured = sessionChecks.some(
        (c) => c.name === "canvas-pat-valid" && c.status === "ok",
      );
      if (canvasConfigured) {
        try {
          capabilities = await probeCapabilities(profile);
        } catch {
          // non-fatal
        }
      }

      const dir = getProfileDir(profile);
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          path.join(dir, "doctor-last.json"),
          JSON.stringify(
            { run_at: new Date().toISOString(), checks: allChecks, capabilities },
            null,
            2,
          ),
          "utf-8",
        );
      } catch {
        // Non-fatal
      }

      const jsonData = {
        ok: allOk,
        checks: allChecks.map((c) => ({
          name: c.name,
          ok: c.status === "ok" || c.status === "skip",
          status: c.status,
          detail: c.detail,
        })),
        capabilities,
      };

      if (opts.json) {
        emitJson(ok(jsonData, { duration_ms: Date.now() - start }));
        return;
      }

      console.log(`\n${pc.bold(`Diagnóstico — wiener-cli v${VERSION}`)}`);
      console.log(pc.dim("─".repeat(42)));
      console.log();

      printSection("Conectividad", connectivityChecks);
      printSection("Sesiones", sessionChecks);
      if (healthChecks.length > 0) printSection("Salud", healthChecks);
      printSection("Entorno", envChecks);
      if (capabilities) printCapabilities(capabilities);

      if (allOk) {
        console.log(`${pc.green("Todo OK ✓")} — el CLI está listo para usarse.`);
      } else {
        console.log(pc.yellow("Algunos checks fallaron. Sigue las acciones indicadas arriba."));
      }

      emitNextSteps([
        { command: "wiener", description: "panorama de hoy" },
        { command: "wiener tareas hoy", description: "qué hay que entregar hoy" },
      ]);

      process.exit(allOk ? 0 : 1);
    });
}
