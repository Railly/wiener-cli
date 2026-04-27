import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import pc from "picocolors";
import { emitNextSteps } from "../../lib/agent/next-steps.ts";
import type { CanvasFile } from "../../lib/api/canvas/files.ts";
import { listAllFiles } from "../../lib/api/canvas/files.ts";
import { auditLog } from "../../lib/audit/log.ts";
import { loadCanvasSession } from "../../lib/auth/store.ts";
import { isWienerLike } from "../../lib/errors.ts";
import { errorEnvelope, successEnvelope } from "../../lib/output/envelope.ts";
import { printError, printLine } from "../../lib/output/human.ts";
import { printJson } from "../../lib/output/json.ts";
import { confirmT2 } from "../../lib/safety/confirm.ts";

const DEFAULT_MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const DEFAULT_CONCURRENCY = 4;

export interface ArchivosManifestFile {
  id: number;
  path: string;
  size: number;
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

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function buildDestPath(file: CanvasFile, destDir: string): string {
  // Canvas files have folder hierarchy via folder_id — without folder tree
  // we flatten to dest/<filename>. Phase C integration can add full_name path.
  const safeName = file.display_name.replace(/[/\\]/g, "_");
  return join(destDir, safeName);
}

function isAlreadyPresent(destPath: string, expectedSize: number): boolean {
  if (!existsSync(destPath)) return false;
  const stat = statSync(destPath);
  return stat.size === expectedSize;
}

async function downloadOne(
  file: CanvasFile,
  destPath: string,
  token: string,
): Promise<"ok" | "skipped" | "failed"> {
  if (isAlreadyPresent(destPath, file.size)) return "skipped";

  try {
    const response = await fetch(file.url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok || !response.body) {
      return "failed";
    }

    mkdirSync(dirname(destPath), { recursive: true });
    const writer = createWriteStream(destPath);
    const reader = response.body.getReader();

    // biome-ignore lint/suspicious/noAssignInExpressions: stream loop pattern
    let chunk: ReadableStreamReadResult<Uint8Array>;
    while (!(chunk = await reader.read()).done) {
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

  const maxSizeBytes = (opts.maxSizeMb ?? 500) * 1024 * 1024;
  const destDir = opts.dir ?? join(process.cwd(), opts.courseId);

  try {
    // Fetch all files for the course
    const files = await listAllFiles(opts.courseId, session.token);

    const totalCount = files.length;
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    // Check size cap
    if (totalSize > maxSizeBytes) {
      const err = errorEnvelope(
        "validation-error",
        `Total size ${formatSize(totalSize)} exceeds limit ${formatSize(maxSizeBytes)}.`,
        `Use --max-size ${Math.ceil(totalSize / 1024 / 1024)} to override.`,
      );
      if (opts.json) {
        printJson(err);
      } else {
        printError(`[validation-error] Total size ${formatSize(totalSize)} exceeds limit.`);
        printLine(pc.dim(`Hint: Use --max-size ${Math.ceil(totalSize / 1024 / 1024)}.`));
      }
      process.exit(1);
      return;
    }

    // Build manifest
    const manifest: ArchivosManifest = {
      totalCount,
      totalSize,
      files: files.map((f) => ({
        id: f.id,
        path: buildDestPath(f, destDir),
        size: f.size,
      })),
    };

    // Compute skip list
    const toSkip = manifest.files.filter((f) => isAlreadyPresent(f.path, f.size));
    const toDownload = manifest.files.filter((f) => !isAlreadyPresent(f.path, f.size));
    const downloadSize = toDownload.reduce((acc, f) => acc + f.size, 0);

    const previewText = [
      pc.bold(`wiener archivos sync — PREVIEW (${opts.courseId})`),
      "─".repeat(48),
      `Archivos:    ${totalCount}`,
      `Tamaño:      ${formatSize(totalSize)}`,
      `Destino:     ${destDir}/`,
      "",
      pc.dim(`Skipping (already present, same size): ${toSkip.length} files`),
      `Will download: ${toDownload.length} files (${formatSize(downloadSize)})`,
      "",
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

    // Map file id → CanvasFile for download
    const fileById = new Map(files.map((f) => [f.id, f]));

    await runConcurrent(toDownload, DEFAULT_CONCURRENCY, async (manifestFile, _idx) => {
      const canvasFile = fileById.get(manifestFile.id);
      if (!canvasFile) {
        failed++;
        return;
      }

      const result = await downloadOne(canvasFile, manifestFile.path, session.token);

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
          printLine(pc.green(`  ✓ ${canvasFile.display_name}`));
        }
      } else if (result === "skipped") {
        skipped++;
      } else {
        failed++;
        if (!opts.json) {
          printLine(pc.red(`  ✗ ${canvasFile.display_name} (failed)`));
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
      console.log(
        `  ${pc.dim("Descargados:".padEnd(labelW))} ${downloaded} archivos${downloadSize > 0 ? ` (${formatSize(downloadSize)})` : ""}`,
      );
      console.log(
        `  ${pc.dim("Saltados:".padEnd(labelW))} ${skipped} (ya existían con mismo tamaño)`,
      );
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
