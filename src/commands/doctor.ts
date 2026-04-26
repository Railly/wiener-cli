import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { getSelf } from "../lib/api/canvas/users.js";
import { loadCanvasSession, loadIntranetSession } from "../lib/auth/store.js";
import { getProfileDir } from "../lib/env.js";
import type { WienerError } from "../lib/errors.js";
import { ok } from "../lib/output/envelope.js";
import { printTable } from "../lib/output/human.js";
import { emitJson } from "../lib/output/json.js";
import { extractCsrfToken } from "../lib/parsers/csrf-token.js";

interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface DoctorOptions {
  json?: boolean;
  profile?: string;
  check?: boolean;
}

async function checkIntranetReachable(): Promise<DoctorCheck> {
  try {
    const resp = await fetch("https://intranet.uwiener.edu.pe/sso.asp", {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return {
      name: "intranet-reachable",
      ok: resp.ok || resp.status < 500,
      detail: `HTTP ${resp.status}`,
    };
  } catch (e) {
    return { name: "intranet-reachable", ok: false, detail: String(e) };
  }
}

async function checkIntranetSession(profile: string): Promise<DoctorCheck> {
  const session = await loadIntranetSession(profile);
  if (!session)
    return {
      name: "intranet-session",
      ok: false,
      detail: "No session stored. Run `wiener auth login`.",
    };
  const ageMin = Math.round((Date.now() - new Date(session.capturedAt).getTime()) / 60000);
  return {
    name: "intranet-session",
    ok: true,
    detail: `${session.codigo} (${session.perfil}), captured ${ageMin}m ago`,
  };
}

async function checkCanvasReachable(): Promise<DoctorCheck> {
  try {
    const resp = await fetch("https://campus.uwiener.edu.pe/api/v1/users/self", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return { name: "canvas-reachable", ok: resp.status !== 0, detail: `HTTP ${resp.status}` };
  } catch (e) {
    return { name: "canvas-reachable", ok: false, detail: String(e) };
  }
}

async function checkCanvasPat(profile: string): Promise<DoctorCheck> {
  const session = await loadCanvasSession(profile);
  if (!session)
    return {
      name: "canvas-pat-valid",
      ok: false,
      detail: "No PAT stored. Run `wiener auth canvas set-token <pat>`.",
    };

  try {
    const user = await getSelf(session.token);
    return { name: "canvas-pat-valid", ok: true, detail: `${user.name} (ID: ${user.id})` };
  } catch (e) {
    const wienerErr = e as WienerError;
    return { name: "canvas-pat-valid", ok: false, detail: wienerErr.message };
  }
}

async function checkCsrfToken(): Promise<DoctorCheck> {
  try {
    const resp = await fetch("https://intranet.uwiener.edu.pe/sso.asp", {
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const token = extractCsrfToken(html);
    return { name: "csrf-token-stable", ok: true, detail: `Found: ${token}` };
  } catch (e) {
    const wienerErr = e as WienerError;
    return { name: "csrf-token-stable", ok: false, detail: wienerErr.message };
  }
}

async function checkPatGenerationEnabled(profile: string): Promise<DoctorCheck> {
  const session = await loadCanvasSession(profile);
  if (!session)
    return {
      name: "pat-generation-enabled",
      ok: false,
      detail: "Canvas not configured; cannot check",
    };

  try {
    const resp = await fetch("https://campus.uwiener.edu.pe/profile/settings", {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const hasLink = html.includes("manageable_access_tokens") || html.includes("New Access Token");
    return {
      name: "pat-generation-enabled",
      ok: hasLink,
      detail: hasLink ? "PAT generation UI found" : "PAT generation UI not found (may be disabled)",
    };
  } catch (e) {
    return { name: "pat-generation-enabled", ok: false, detail: String(e) };
  }
}

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Run health checks on both backends and auth")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--check", "Run live API validation checks")
    .action(async (opts: DoctorOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";

      const checks: DoctorCheck[] = [];

      // Always run
      checks.push(await checkIntranetReachable());
      checks.push(await checkIntranetSession(profile));
      checks.push(await checkCanvasReachable());

      // Live checks (--check flag or always for Canvas PAT if configured)
      const canvasSession = await loadCanvasSession(profile);
      if (canvasSession) {
        checks.push(await checkCanvasPat(profile));
        checks.push(await checkPatGenerationEnabled(profile));
      } else {
        checks.push({ name: "canvas-pat-valid", ok: false, detail: "No PAT configured" });
        checks.push({ name: "pat-generation-enabled", ok: false, detail: "Canvas not configured" });
      }

      if (opts.check) {
        checks.push(await checkCsrfToken());
      }

      const allOk = checks.every((c) => c.ok);

      const dir = getProfileDir(profile);
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          path.join(dir, "doctor-last.json"),
          JSON.stringify({ run_at: new Date().toISOString(), checks }, null, 2),
          "utf-8",
        );
      } catch {
        // Non-fatal
      }

      const data = { ok: allOk, checks };

      if (opts.json) {
        emitJson(ok(data, { duration_ms: Date.now() - start }));
      }

      printTable(
        checks.map((c) => ({
          ...c,
          ok: c.ok ? pc.green("✓") : pc.red("✗"),
        })),
        [
          { header: "Check", key: "name" },
          { header: "Status", key: "ok" },
          { header: "Detail", key: "detail" },
        ],
      );

      if (!allOk) {
        console.log();
        console.log(
          pc.yellow(
            "Some checks failed. Run `wiener auth login` or `wiener auth canvas set-token` to fix auth issues.",
          ),
        );
      }

      process.exit(allOk ? 0 : 1);
    });
}
