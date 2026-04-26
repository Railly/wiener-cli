# REFACTOR-NOTES — Phase F: Cligentic Block Integration

## Decisions per block

### REPLACED (7 blocks)

| Block | wiener-cli surface changed | Why |
|---|---|---|
| `xdg-paths` | `src/lib/env.ts` now calls `getWienerPaths()` from new `src/lib/foundation/xdg-paths.ts` | Replaces hardcoded `~/.wiener/`. On macOS uses `~/Library/Application Support/wiener`, on Linux uses XDG. `WIENER_CONFIG_DIR` env override still works for tests. |
| `atomic-write` | `state/snapshot.ts`, `courses/alias-store.ts`, `config.ts`, `auth/keychain-noop.ts` all replaced `writeFileSync` with `atomicWriteJson`/`atomicWrite` | Crash-safe writes via temp+fsync+rename. Session files get mode 0o600. |
| `detect` | `src/lib/platform/detect.ts` added; `doctor.ts` gains `env` health check showing `platform`, `ci`, `wsl` | WSL-aware environment detection. Useful for debugging. |
| `open-url` | `src/lib/browser-open.ts` delegates to `src/lib/platform/open-url.ts` | Cross-platform: WSL (wslview/cmd.exe), BROWSER env var, graceful CI fallback. Old `openInBrowser` kept as alias. |
| `notify-os` | `src/lib/platform/notify-os.ts` added; `watch-loop.ts` uses it instead of `notifyMacos` | Cross-platform: macOS osascript, WSL+Windows powershell, Linux notify-send. `notify/macos.ts` kept for backward compat (test mocks `Bun.spawn`). |
| `audit-log` | `src/lib/foundation/audit-log.ts`; `src/lib/audit/log.ts` delegates to it | Daily rotation (audit/YYYY-MM-DD.jsonl), mode 0o600, grep-friendly. Old `AuditEntry` shape preserved via adapter in `audit/log.ts`. |
| `audit-lifecycle` | `src/lib/foundation/audit-lifecycle.ts`; `tramite/generar.ts` uses `beginAudit`/`lifecycle.complete()` | Two-phase pattern: pending → ok/error/blocked/dry-run. Replaces two separate `auditLog` calls with a single lifecycle object. |

### HYBRID (2 blocks)

| Block | What was ported | What was kept |
|---|---|---|
| `trust-ladder` | Added `TrustLevel` type and `confirmT3()` function with `--confirm <id>` vs `--confirm-against` check | Kept `WienerError` (not `AppError`) and `@clack/prompts` for interactive TTY. Test mocks `@clack/prompts` and does `instanceof WienerError` — swapping would break both. |
| `next-steps` | `src/lib/agent/next-steps.ts` added with `emitNextSteps()` + auth-specific step consts. Wired to `tramite generar` auth-required error path. | Kept wiener's envelope format (not cligentic's naked NDJSON). |

### KEPT as hand-rolled (7 blocks)

| Block | Why |
|---|---|
| `error-map` | `WienerError` has domain subclasses, `isWienerLike` duck-type (Bun module mock boundary workaround), `ERROR_EXIT_CODES`, `toErrorEnvelope`. Cligentic's `AppError` uses `human` field instead of `message`, no `exitCode`. Full migration would break 25+ test assertions. |
| `json-mode` | wiener's `OkEnvelope { ok: true, data, meta }` is the documented agent contract used by every command. Cligentic's `emit()` outputs the value directly (no `ok` wrapper). Incompatible shapes. |
| `config` | wiener's `WienerConfig` is a typed flat struct with deep section merges. Cligentic uses `{ defaults, profiles }` schema structure. Migration would require schema transformation. |
| `session` | wiener has macOS Keychain + file fallback, dual session types (intranet/canvas). Cligentic's `session` is single-file only. wiener is strictly more capable. |
| `global-flags` | wiener's commander-based per-subcommand flags are better for this codebase's size. Cligentic's block is useful for simpler CLIs. |
| `doctor` | wiener's `doctor` has 5 wiener-specific checks (CSRF token, Canvas PAT, Intranet reachability). Cligentic provides a reusable check-runner pattern, but wiener already has that pattern. Added cligentic's `detect` block to add env info row. |
| `argv` | Not evaluated — wiener uses Commander which is already installed. |

## PRs filed to Railly/cligentic

None filed. All cligentic blocks were correct as shipped. Identified no bugs. One observation worth noting for upstream:

- `trust-ladder` imports `AppError` from `error-map` in the same package, which creates a hard dependency that prevents adopters using their own error class. A future improvement would be to accept an error factory function as a parameter. Not critical enough to warrant a PR now.

## LOC delta

- Lines added (new foundation/platform/agent files): ~430
- Lines removed (from simplified delegates): ~80
- Net: +350 LOC across 19 files
- The apparent increase is expected: cligentic blocks are standalone, self-contained files. The reduction is in call-site code (no more `mkdirSync` + `writeFileSync` pairs scattered across 5 files, no separate `open()` per platform, no macOS-only notify path in watch-loop).

## Final state

- Tests: **211/211 pass**
- Build: **clean** (296 modules, 137ms compile)
- Lint: 16 errors remaining (all pre-existing in `archivos/download.ts`, `archivos/sync.ts`, `tareas/hoy.ts`, `tareas/semana.ts` — none in Phase F files)
- Pre-existing lint errors fixed as side effect of biome auto-fix pass: 34 → 16 (-18)
