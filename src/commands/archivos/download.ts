import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pc from "picocolors";
import { getFile } from "../../lib/api/canvas/files.ts";
import { auditLog } from "../../lib/audit/log.ts";
import { loadCanvasSession } from "../../lib/auth/store.ts";
import { emitNextSteps } from "../../lib/agent/next-steps.ts";
import { WienerError, isWienerLike } from "../../lib/errors.ts";
import { errorEnvelope, successEnvelope } from "../../lib/output/envelope.ts";
import { printError, printLine } from "../../lib/output/human.ts";
import { printJson } from "../../lib/output/json.ts";
import { confirmT2 } from "../../lib/safety/confirm.ts";

const LARGE_FILE_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface ArchivosDownloadOptions {
  fileId: string;
  out?: string;
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  json: boolean;
  noInput: boolean;
  profile: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function renderProgress(downloaded: number, total: number, filename: string): void {
  if (total === 0) return;
  const pct = Math.min(100, Math.floor((downloaded / total) * 100));
  const barWidth = 32;
  const filled = Math.floor((pct / 100) * barWidth);
  const bar = pc.cyan("█".repeat(filled)) + pc.dim("░".repeat(barWidth - filled));
  const sizeStr = `${formatSize(downloaded)} / ${formatSize(total)}`;
  const speed = "";
  process.stderr.write(
    `\r${pc.dim("Descargando:")} ${pc.bold(filename.slice(0, 28))}\n[${bar}] ${pct}%  ${sizeStr}${speed}  \x1b[1A`,
  );
}

export async function runArchivosDownload(opts: ArchivosDownloadOptions): Promise<void> {
  const startMs = Date.now();
  const txId = `tx_${Date.now()}`;

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

  try {
    // Fetch file metadata
    const file = await getFile(opts.fileId, session.token);

    // Determine destination path
    const outPath = opts.out ? resolve(opts.out) : resolve(process.cwd(), file.display_name);

    // Check if file already exists
    if (existsSync(outPath) && !opts.force) {
      const err = errorEnvelope(
        "validation-error",
        `File already exists: ${outPath}`,
        "Use --force to overwrite.",
      );
      if (opts.json) {
        printJson(err);
      } else {
        printError(`[validation-error] File already exists: ${outPath}`);
        printLine(pc.dim("Hint: Use --force to overwrite."));
      }
      process.exit(1);
      return;
    }

    // T2 gate for large files
    const isLarge = file.size > LARGE_FILE_THRESHOLD_BYTES;
    const trustLevel = isLarge ? "T2" : "T0";

    if (isLarge) {
      const previewText = [
        pc.bold("wiener archivos download — PREVIEW"),
        "─".repeat(40),
        `File:        ${file.display_name}  (${formatSize(file.size)})`,
        `Destination: ${outPath}`,
        "",
        pc.yellow(`File is ${formatSize(file.size)} — larger than 50 MB threshold.`),
        pc.dim("Continúa con --yes o cancela con Ctrl+C."),
      ].join("\n");

      const decision = await confirmT2("archivos download", previewText, {
        yes: opts.yes,
        dryRun: opts.dryRun,
        noInput: opts.noInput,
      });

      if (decision === "dry-run") {
        const data = {
          dryRun: true,
          fileId: opts.fileId,
          display_name: file.display_name,
          size: file.size,
          size_human: formatSize(file.size),
          destination: outPath,
        };
        if (opts.json) {
          printJson(
            successEnvelope(data, { duration_ms: Date.now() - startMs, from_cache: false }),
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
    } else if (opts.dryRun) {
      // T0 dry-run still supported
      const data = {
        dryRun: true,
        fileId: opts.fileId,
        display_name: file.display_name,
        size: file.size,
        size_human: formatSize(file.size),
        destination: outPath,
      };
      if (opts.json) {
        printJson(successEnvelope(data, { duration_ms: Date.now() - startMs, from_cache: false }));
      } else {
        printLine(`Would download: ${file.display_name} (${formatSize(file.size)}) → ${outPath}`);
        printLine(pc.dim("[dry-run] No action taken."));
      }
      return;
    }

    // Audit started (T2 only)
    if (isLarge) {
      auditLog({
        ts: new Date().toISOString(),
        cmd: "archivos download",
        args: { fileId: opts.fileId, out: outPath, size: file.size },
        result: "started",
        id: txId,
      });
    }

    // Stream download
    mkdirSync(dirname(outPath), { recursive: true });
    const response = await fetch(file.url, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (!response.ok || !response.body) {
      throw new WienerError("network-error", `Download failed: HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");

    const writer = createWriteStream(outPath);
    const reader = response.body.getReader();

    let downloaded = 0;
    const showProgress = !opts.json && !opts.noInput;

    // biome-ignore lint/suspicious/noAssignInExpressions: stream loop pattern
    let chunk: ReadableStreamReadResult<Uint8Array>;
    while (!(chunk = await reader.read()).done) {
      const value = chunk.value;
      writer.write(value);
      downloaded += value.byteLength;
      if (showProgress) {
        renderProgress(downloaded, contentLength || file.size, file.display_name);
      }
    }

    await new Promise<void>((res, rej) => {
      writer.end();
      writer.on("finish", res);
      writer.on("error", rej);
    });

    if (showProgress) {
      process.stderr.write("\n");
    }

    // Verify content-length
    if (contentLength > 0 && downloaded !== contentLength) {
      throw new WienerError(
        "network-error",
        `Download incomplete: got ${downloaded} bytes, expected ${contentLength}.`,
      );
    }

    const durationMs = Date.now() - startMs;

    // Audit success (T2 only)
    if (isLarge) {
      auditLog({
        ts: new Date().toISOString(),
        cmd: "archivos download",
        args: { fileId: opts.fileId, out: outPath, size: file.size },
        result: "ok",
        id: txId,
        path: outPath,
        duration_ms: durationMs,
        trust: trustLevel,
      });
    }

    const resultData = {
      ok: true,
      path: outPath,
      size: downloaded,
      size_human: formatSize(downloaded),
      duration_ms: durationMs,
    };

    if (opts.json) {
      printJson(successEnvelope(resultData, { duration_ms: durationMs, from_cache: false }));
    } else {
      if (showProgress) process.stderr.write("\n");
      const labelW = 10;
      console.log(`\n${pc.cyan("✓")} ${pc.bold("Descargado")}\n`);
      console.log(`  ${pc.dim("Archivo:".padEnd(labelW))} ${pc.bold(file.display_name)}`);
      console.log(`  ${pc.dim("Tamaño:".padEnd(labelW))} ${formatSize(downloaded)}`);
      console.log(`  ${pc.dim("Destino:".padEnd(labelW))} ${outPath}`);
      console.log(`  ${pc.dim("Duración:".padEnd(labelW))} ${(durationMs / 1000).toFixed(1)}s`);
      emitNextSteps([
        { command: `open "${outPath}"`, description: "abrir el archivo" },
        { command: `wiener archivos sync <ref>`, description: "descargar todo el curso", optional: true },
      ]);
    }
  } catch (e) {
    if (isWienerLike(e)) {
      auditLog({
        ts: new Date().toISOString(),
        cmd: "archivos download",
        args: { fileId: opts.fileId },
        result: "error",
        id: txId,
        error: { code: e.code, message: e.message },
      });

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
