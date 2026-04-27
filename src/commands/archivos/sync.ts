import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import pc from "picocolors";
import { emitNextSteps } from "../../lib/agent/next-steps.ts";
import type { ModuleFileItem } from "../../lib/api/canvas/modules.ts";
import { fetchModuleFileItems } from "../../lib/api/canvas/modules.ts";
import { auditLog } from "../../lib/audit/log.ts";
import { loadCanvasSession } from "../../lib/auth/store.ts";
import { isWienerLike } from "../../lib/errors.ts";
import { errorEnvelope, successEnvelope } from "../../lib/output/envelope.ts";
import { printError, printLine } from "../../lib/output/human.ts";
import { printJson } from "../../lib/output/json.ts";
import { confirmT2 } from "../../lib/safety/confirm.ts";

const DEFAULT_CONCURRENCY = 4;

export interface ArchivosManifestFile {
  id: number;
  path: string;
  size: number;
  url?: string;
}

export interface ArchivosManifest {
  totalCount: number;
  totalSize: number;
  files: ArchivosManifestFile[];
}

export interface ArchivosDownloadResult {
  ok: boolean;
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  dir: string;
}

export interface ArchivosSyncOptions {
  courseId: string;
  dir?: string;
  yes: boolean;
  dryRun: boolean;
  json: boolean;
  noInput: boolean;
  maxSizeMb?: number;
  profile: string;
}

function buildDestPathFromTitle(title: string, destDir: string): string {
  const safeName = title.replace(/[/\\]/g, "_");
  return join(destDir, safeName);
}

function isAlreadyPresent(destPath: string): boolean {
  return existsSync(destPath);
}

async function downloadOne(
  item: ModuleFileItem,
  destPath: string,
  token: string,
): Promise<"ok" | "skipped" | "failed"> {
  if (isAlreadyPresent(destPath)) return "skipped";

  try {
    const response = await fetch(item.url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok || !response.body) {
      return "failed";
    }

    mkdirSync(dirname(destPath), { recursive: true });
    const writer = createWriteStream(destPath);
    const reader = response.body.getReader();

    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      writer.write(chunk.value);
    }

    await new Promise<void>((res, rej) => {
      writer.end();
      writer.on("finish", res);
      writer.on("error", rej);
    });

    return "ok";
  } catch {
    return "failed";
  }
}

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export async function runArchivosSync(opts: ArchivosSyncOptions): Promise<void> {
  const startMs = Date.now();

  const session = loadCanvasSession(opts.profile);
  if (!session) {
    const err = errorEnvelope(
      "canvas-not-configured",
      "No Canvas token. Run `wiener auth canvas set-token <pat>` first.",
      "wiener auth canvas set-token",
    );
    if (opts.json) {
      printJson(err);
    } else {
      printError(err.error.message);
    }
    process.exit(1);
  }

  const destDir = opts.dir ?? join(process.cwd(), opts.courseId);

  try {
    const items = await fetchModuleFileItems(opts.courseId);
    const totalCount = items.length;

    // Build manifest (no size info from modules, so size=0 as placeholder)
    const manifest: ArchivosManifest = {
      totalCount,
      totalSize: 0,
      files: items.map((item) => ({
        id: item.id,
        path: buildDestPathFromTitle(item.title, destDir),
        size: 0,
        url: item.url,
      })),
    };

    const toSkip = manifest.files.filter((f) => isAlreadyPresent(f.path));
    const toDownload = manifest.files.filter((f) => !isAlreadyPresent(f.path));

    const previewText = [
      pc.bold(`wiener archivos sync — PREVIEW (${opts.courseId})`),
      "─".repeat(48),
      `Archivos:    ${totalCount}`,
      `Destino:     ${destDir}/`,
      "",
      pc.dim(`Skipping (already present): ${toSkip.length} files`),
      `Will download: ${toDownload.length} files`,
      "",
      pc.dim("Wiener restringe /files — usando módulos como fuente."),
      pc.dim("Continúa con --yes."),
    ].join("\n");

    const decision = await confirmT2("archivos sync", previewText, {
      yes: opts.yes,
      dryRun: opts.dryRun,
      noInput: opts.noInput,
    });

    if (decision === "dry-run") {
      if (opts.json) {
        printJson(
          successEnvelope(
            { dryRun: true, manifest },
            { duration_ms: Date.now() - startMs, from_cache: false },
          ),
        );
      } else {
        printLine(previewText);
        printLine(pc.dim("\n[dry-run] No action taken."));
      }
      return;
    }

    if (decision === "aborted") {
      const err = errorEnvelope("validation-error", "Cancelled by user.");
      if (opts.json) {
        printJson(err);
      } else {
        printLine(pc.dim("Cancelled."));
      }
      process.exit(0);
      return;
    }

    if (!opts.json) {
      printLine(previewText);
      printLine("");
    }

    mkdirSync(destDir, { recursive: true });

    let downloaded = 0;
    let skipped = toSkip.length;
    let failed = 0;

    const itemById = new Map(items.map((item) => [item.id, item]));

    await runConcurrent(toDownload, DEFAULT_CONCURRENCY, async (manifestFile, _idx) => {
      const moduleItem = itemById.get(manifestFile.id);
      if (!moduleItem) {
        failed++;
        return;
      }

      const result = await downloadOne(moduleItem, manifestFile.path, session.token);

      if (result === "ok") {
        downloaded++;
        auditLog({
          ts: new Date().toISOString(),
          cmd: "archivos sync",
          args: { courseId: opts.courseId, fileId: manifestFile.id, path: manifestFile.path },
          result: "ok",
          id: `tx_${Date.now()}_${manifestFile.id}`,
        });
        if (!opts.json) {
          printLine(pc.green(`  ✓ ${moduleItem.title}`));
        }
      } else if (result === "skipped") {
        skipped++;
      } else {
        failed++;
        if (!opts.json) {
          printLine(pc.red(`  ✗ ${moduleItem.title} (failed)`));
        }
      }
    });

    const durationMs = Date.now() - startMs;
    const resultData: ArchivosDownloadResult = {
      ok: failed === 0,
      total: totalCount,
      downloaded,
      skipped,
      failed,
      dir: destDir,
    };

    if (opts.json) {
      printJson(successEnvelope(resultData, { duration_ms: durationMs, from_cache: false }));
    } else {
      const labelW = 15;
      console.log(`\n${pc.cyan("✓")} ${pc.bold("Sincronización completa")}\n`);
      console.log(`  ${pc.dim("Descargados:".padEnd(labelW))} ${downloaded} archivos`);
      console.log(`  ${pc.dim("Saltados:".padEnd(labelW))} ${skipped} (ya existían)`);
      console.log(
        `  ${pc.dim("Fallidos:".padEnd(labelW))} ${failed === 0 ? pc.green("0") : pc.red(String(failed))}`,
      );
      emitNextSteps([
        { command: `open "${destDir}"`, description: "abrir carpeta" },
        {
          command: `wiener archivos arbol ${opts.courseId}`,
          description: "ver estructura del curso",
          optional: true,
        },
      ]);
    }
  } catch (e) {
    if (isWienerLike(e)) {
      const err = errorEnvelope(e.code, e.message, e.hint);
      if (opts.json) {
        printJson(err);
      } else {
        printError(`[${e.code}] ${e.message}`);
        if (e.hint) printLine(pc.dim(`Hint: ${e.hint}`));
      }
      process.exit(1);
      return;
    }
    throw e;
  }
}
