---
type: scaffold
cli: wiener-cli
created: 2026-04-26 (v2)
source: "[[shaping]]"
---

# wiener-cli — Scaffold (v2)

Aligned with student-first shaping (top-level plano + namespaces espejo, course
resolver fuzzy, alias wizard, `wiener nuevo`/`watch`, all hidden Canvas tabs
unlocked).

## Directory Structure

```
wiener-cli/
├── package.json
├── tsconfig.json
├── biome.json
├── bunfig.toml
├── README.md
├── src/
│   ├── cli.ts                          # commander root, top-level + namespaces
│   ├── commands/
│   │   ├── _root.ts                    # `wiener` solo → panorama hoy
│   │   ├── hoy.ts                      # wiener hoy
│   │   ├── ahora.ts                    # wiener ahora
│   │   ├── semana.ts                   # wiener semana
│   │   ├── nuevo.ts                    # wiener nuevo (diff state)
│   │   ├── watch.ts                    # wiener watch (background loop + macOS notif)
│   │   ├── doctor.ts                   # health check both backends
│   │   ├── schema.ts                   # introspection
│   │   ├── config.ts                   # config show/path
│   │   ├── auth/
│   │   │   ├── login.ts                # intranet 2-step XHR + form-post
│   │   │   ├── status.ts
│   │   │   ├── logout.ts
│   │   │   └── canvas/
│   │   │       ├── set-token.ts
│   │   │       ├── pat-new.ts          # opens browser at /profile/settings
│   │   │       └── clear.ts
│   │   ├── cursos/
│   │   │   ├── list.ts                 # wiener cursos [--all]
│   │   │   ├── info.ts                 # wiener cursos info <ref>
│   │   │   ├── abrir.ts                # opens browser
│   │   │   ├── favoritos.ts
│   │   │   └── aliases/
│   │   │       ├── wizard.ts           # interactive clack
│   │   │       ├── list.ts
│   │   │       └── reset.ts
│   │   ├── tareas/
│   │   │   ├── list.ts                 # all + by-course
│   │   │   ├── hoy.ts
│   │   │   ├── semana.ts
│   │   │   └── info.ts
│   │   ├── planner.ts                  # /api/v1/planner/items
│   │   ├── calificaciones/
│   │   │   ├── list.ts                 # cross-course (Canvas)
│   │   │   └── detail.ts               # by course
│   │   ├── notas/                      # intranet (official grades)
│   │   │   ├── list.ts
│   │   │   └── periodos.ts
│   │   ├── historial.ts
│   │   ├── horario/
│   │   │   ├── week.ts
│   │   │   ├── hoy.ts
│   │   │   └── ahora.ts
│   │   ├── asistencia.ts
│   │   ├── plan/
│   │   │   ├── list.ts
│   │   │   └── avance.ts
│   │   ├── examenes.ts
│   │   ├── matricula.ts
│   │   ├── perfil.ts
│   │   ├── pagos/
│   │   │   ├── list.ts
│   │   │   └── historial.ts
│   │   ├── tramite/
│   │   │   ├── list.ts
│   │   │   └── generar.ts              # T2
│   │   ├── anuncios/
│   │   │   ├── list.ts
│   │   │   ├── by-course.ts
│   │   │   └── globales.ts
│   │   ├── archivos/
│   │   │   ├── list.ts                 # flat
│   │   │   ├── arbol.ts                # tree
│   │   │   ├── download.ts             # T2 if >50MB
│   │   │   └── sync.ts                 # T2 bulk
│   │   ├── modulos.ts
│   │   ├── syllabus.ts
│   │   ├── paginas.ts
│   │   ├── discusiones.ts
│   │   ├── quizzes.ts
│   │   ├── conferencias.ts
│   │   ├── calendario/
│   │   │   ├── list.ts
│   │   │   └── ics.ts                  # download .ics
│   │   ├── inbox/
│   │   │   ├── list.ts
│   │   │   └── info.ts
│   │   └── _namespaces/
│   │       ├── intranet.ts             # mirrors subset
│   │       └── canvas.ts               # mirrors subset
│   ├── lib/
│   │   ├── workflows/                  # high-level orchestrations
│   │   │   ├── intranet-login.ts       # 2-step dance
│   │   │   ├── canvas-paginate.ts      # follow Link rel=next
│   │   │   ├── doctor-checks.ts
│   │   │   ├── panorama.ts             # composes hoy+ahora+pendiente+nuevo for `wiener` solo
│   │   │   ├── nuevo-diff.ts           # snapshot + diff state
│   │   │   ├── watch-loop.ts           # background runner + notif
│   │   │   └── archivos-sync.ts        # bulk download orchestration
│   │   ├── api/
│   │   │   ├── intranet/
│   │   │   │   ├── client.ts           # HTTP client w/ ASP cookie management
│   │   │   │   ├── login.ts            # autenticate.asp + ValidaAcceso.asp
│   │   │   │   ├── notas.ts
│   │   │   │   ├── horario.ts
│   │   │   │   ├── asistencia.ts
│   │   │   │   ├── plan.ts
│   │   │   │   ├── historial.ts
│   │   │   │   ├── examenes.ts
│   │   │   │   ├── matricula.ts
│   │   │   │   ├── perfil.ts
│   │   │   │   ├── pagos.ts
│   │   │   │   └── tramite.ts
│   │   │   └── canvas/
│   │   │       ├── client.ts           # fetch + Bearer + rate-limit tracking
│   │   │       ├── courses.ts
│   │   │       ├── assignments.ts
│   │   │       ├── planner.ts
│   │   │       ├── enrollments.ts      # for cross-course grades
│   │   │       ├── submissions.ts
│   │   │       ├── announcements.ts
│   │   │       ├── files.ts
│   │   │       ├── modules.ts
│   │   │       ├── pages.ts
│   │   │       ├── discussion-topics.ts
│   │   │       ├── quizzes.ts
│   │   │       ├── conferences.ts
│   │   │       ├── calendar.ts         # /upcoming_events, /todo, /calendar_events
│   │   │       └── conversations.ts
│   │   ├── parsers/                    # cheerio HTML parsers for intranet
│   │   │   ├── notas-table.ts
│   │   │   ├── horario-table.ts
│   │   │   ├── asistencia-table.ts
│   │   │   ├── plan-table.ts
│   │   │   ├── pagos-table.ts
│   │   │   ├── examenes-table.ts
│   │   │   ├── matricula-table.ts
│   │   │   ├── csrf-token.ts           # scrape sso.asp
│   │   │   └── auth-expired-detector.ts # detects SiguNet.htm signature
│   │   ├── courses/
│   │   │   ├── resolver.ts             # smart matcher (exact > substring > fuzzy)
│   │   │   ├── fuzzy-score.ts          # ~80 lines, no dep
│   │   │   ├── grouping.ts             # T/P/PD section grouping
│   │   │   ├── alias-store.ts          # ~/.wiener/aliases.json read/write
│   │   │   └── auto-alias.ts           # generates default aliases from name
│   │   ├── validation/
│   │   │   ├── schemas.ts              # zod for I/O contracts
│   │   │   └── inputs.ts               # periodo format, course_code regex, etc
│   │   ├── auth/
│   │   │   ├── store.ts                # session/PAT persist (keychain-first, file fallback)
│   │   │   ├── keychain-mac.ts         # macOS Keychain via `security` cmd
│   │   │   ├── keychain-noop.ts        # Linux/CI fallback to file
│   │   │   └── prompt.ts               # @clack/prompts for credential entry
│   │   ├── output/
│   │   │   ├── envelope.ts             # canonical { ok, data, meta } / { ok, error }
│   │   │   ├── json.ts
│   │   │   ├── ndjson.ts
│   │   │   ├── human.ts                # tables + color (cli-table3, picocolors)
│   │   │   ├── panorama-renderer.ts    # the `wiener` solo render
│   │   │   ├── nuevo-renderer.ts       # diff display
│   │   │   └── fields.ts               # --fields projection
│   │   ├── state/
│   │   │   ├── snapshot.ts             # ~/.wiener/state.json read/write
│   │   │   └── diff.ts                 # compute deltas between snapshots
│   │   ├── audit/
│   │   │   └── log.ts                  # JSONL append to ~/.wiener/audit.jsonl
│   │   ├── notify/
│   │   │   ├── macos.ts                # osascript display notification
│   │   │   └── whatsapp.ts             # optional Kapso bridge
│   │   ├── cache/
│   │   │   └── kv.ts                   # 5-min TTL for /assignments calls etc
│   │   ├── errors.ts                   # typed error hierarchy + canonical codes
│   │   ├── env.ts                      # WIENER_* env vars
│   │   ├── tty.ts                      # is-tty + --no-input enforcement
│   │   ├── browser-open.ts             # `open` cmd on macOS, xdg-open Linux
│   │   └── version.ts                  # injected from package.json
│   └── types/
│       ├── intranet.ts
│       ├── canvas.ts                   # mirrors Canvas REST shapes
│       ├── course.ts                   # canonical Course + Section + Alias types
│       ├── state.ts                    # snapshot shape
│       └── config.ts
├── tests/
│   ├── parsers/
│   │   ├── notas.test.ts               # against fixtures
│   │   ├── horario.test.ts
│   │   ├── asistencia.test.ts
│   │   └── csrf-token.test.ts
│   ├── courses/
│   │   ├── resolver.test.ts            # exact, substring, fuzzy, ambiguous, no-match
│   │   ├── fuzzy-score.test.ts         # transposition, substring, accent
│   │   ├── grouping.test.ts            # T/P/PD merging
│   │   └── auto-alias.test.ts          # collision dedup
│   ├── api/
│   │   ├── intranet-login.test.ts      # 2-step dance, all estado branches
│   │   ├── canvas-pagination.test.ts   # Link header
│   │   ├── canvas-rate-limit.test.ts   # X-Canvas-Meta parsing
│   │   └── auth-expired.test.ts        # SiguNet.htm detection
│   ├── state/
│   │   └── diff.test.ts                # snapshot diff correctness
│   ├── output/
│   │   ├── envelope.test.ts            # canonical shape
│   │   ├── panorama.test.ts            # snapshot test of `wiener` solo render
│   │   └── nuevo.test.ts
│   ├── auth/
│   │   └── store.test.ts               # keychain + file fallback
│   ├── live/                           # gated by WIENER_LIVE_TEST=1
│   │   ├── intranet-smoke.test.ts
│   │   └── canvas-smoke.test.ts
│   └── fixtures/
│       ├── sso-asp-page.html
│       ├── notas-2026-I.html
│       ├── horario-week.html
│       ├── obligaciones.html
│       ├── canvas-courses.json
│       ├── canvas-assignments.json
│       ├── canvas-planner-items.json
│       ├── canvas-conversations.json
│       └── canvas-files-tree.json
└── scripts/
    ├── refresh-fixtures.ts             # re-fetch HTML/JSON fixtures from live (manual)
    └── install.sh                      # symlink bin/wiener to ~/.local/bin/
```

## package.json

```json
{
  "name": "@railly/wiener-cli",
  "version": "0.1.0",
  "private": true,
  "description": "Agent-first CLI for Universidad Norbert Wiener student portals (intranet ASP + Canvas LMS).",
  "type": "module",
  "bin": {
    "wiener": "./bin/wiener"
  },
  "files": ["bin/", "dist/"],
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile bin/wiener --target=bun-darwin-arm64",
    "build:linux": "bun build src/cli.ts --compile --outfile bin/wiener-linux --target=bun-linux-x64",
    "test": "bun test --bail",
    "test:watch": "bun test --watch",
    "test:live": "WIENER_LIVE_TEST=1 bun test tests/live/",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  },
  "engines": {
    "bun": ">=1.3.0"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "@clack/prompts": "^0.10.0",
    "cheerio": "^1.0.0",
    "zod": "^4.0.0",
    "picocolors": "^1.1.0",
    "cli-table3": "^0.6.5"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@types/bun": "latest",
    "typescript": "^5.6.0"
  }
}
```

Notes:
- **No fuzzy lib dep** — `lib/courses/fuzzy-score.ts` is ~80 lines hand-rolled
  (substring + char-order + position bonuses). Smaller surface, no version drift.
- **No TUI lib** — clack/prompts handles wizard, picocolors+cli-table3 the human render.
- **No fetch lib** — Bun built-in `fetch` + manual `Cookie` header for ASP.

## Global Flags (every command)

| Flag | Purpose |
|------|---------|
| `--json` | JSON envelope to stdout |
| `--ndjson` | Streaming JSON per line (for paginated/long results) |
| `--dry-run` | Preview T2 mutations |
| `--verbose` | Detailed stderr + audit-log T0 commands |
| `--quiet` | Suppress stderr |
| `--no-input` | Force non-interactive (auto-on if !isTTY(stdin)) |
| `--yes` | Skip T2 confirmations |
| `--exact` | Course resolver: exact match only, no fuzzy |
| `--fields a,b,c` | Project specific keys in JSON |
| `--params '<json>'` | Canonical input override |
| `--config PATH` | Override config dir |
| `--profile NAME` | Use named profile |
| `--help`, `-h` | Help |
| `--version`, `-v` | Version |

## Auth Strategy

### Intranet (ASP cookie)

- **Storage**: macOS Keychain item `wiener-cli.intranet.<profile>` containing
  `{ aspCookieName, aspCookieValue, perfil, capturedAt, codigo }`.
  Linux/CI fallback: `~/.wiener/<profile>/intranet-session.json` (`0600`).
- **Lifecycle**: 2-step XHR + form-POST during `auth login`. Cookie stored
  immediately. Auth-expired detector (`SiguNet.htm` signature) wipes session
  on detection. `auth logout` calls `/CerrarSesion.asp?p=alu` and wipes.
- **Password**: NEVER persisted. Held in memory for the single request only.

### Canvas (PAT)

- **Storage**: macOS Keychain item `wiener-cli.canvas.<profile>` containing
  `{ token, validatedAt, userId, primaryEmail }`.
- **Lifecycle**: `auth canvas set-token <pat>` → validates against
  `GET /api/v1/users/self` → stores on success. Every Canvas command sends
  `Authorization: Bearer <token>`. On 401 → wipe stored PAT, surface
  `canvas-token-invalid` with hint.
- **PAT generation**: `auth canvas pat new` opens default browser at
  `/profile/settings`. CLI then waits for stdin paste of the PAT, validates,
  stores. (Cannot create PATs via API — Canvas requires OAuth dev key, which
  Wiener doesn't expose to students.)

### Env var overrides (CI / automation)

- `WIENER_INTRANET_USER`, `WIENER_INTRANET_PASS`, `WIENER_INTRANET_PERFIL=A`
- `WIENER_CANVAS_TOKEN`
- `WIENER_PROFILE`
- `WIENER_CONFIG_DIR`

## State Management

```
~/.wiener/
├── config.json
├── audit.jsonl                          # all T2 + verbose T0
├── state.json                           # snapshots for `wiener nuevo`
├── aliases.json                         # global default profile aliases (or per-profile)
├── watch.pid                            # PID of running watch (lockfile)
├── watch.log                            # watch output log
├── default/
│   ├── intranet-session.json            # only if no keychain
│   ├── canvas-session.json              # only if no keychain
│   ├── csrf-token.json                  # last-seen csrfToken (staleness probe)
│   ├── periodos-cache.json              # periodos list, refreshed weekly
│   └── doctor-last.json
└── cache/
    └── canvas-{endpoint}-{key}.json     # 5-min TTL responses
```

`config.json`:
```json
{
  "version": 1,
  "default_profile": "default",
  "log_level": "info",
  "log_t0_commands": false,
  "course_resolver": {
    "fuzzy_confirm_threshold": 0.85,
    "fuzzy_unique_delta": 0.30,
    "no_input_auto_threshold": 0.92,
    "no_match_top_n": 5
  },
  "intranet": {
    "base_url": "https://intranet.uwiener.edu.pe",
    "request_timeout_ms": 15000,
    "user_agent": "wiener-cli/0.1.0 (+https://github.com/Railly/wiener-cli)"
  },
  "canvas": {
    "base_url": "https://campus.uwiener.edu.pe",
    "per_page": 100,
    "request_timeout_ms": 30000,
    "concurrency": 4,
    "cache_ttl_ms": 300000
  },
  "watch": {
    "interval_ms": 1800000,
    "notify": "macos",                   // or "whatsapp" or "none"
    "snooze_until": null
  },
  "panorama": {
    "show_diff": true,
    "diff_max_age_hours": 168            // hide diff section if state >7 days old
  }
}
```

## Course Resolver

`lib/courses/resolver.ts`:

```typescript
type Resolution =
  | { kind: 'exact'; course: Course; matchedOn: 'code' | 'alias' }
  | { kind: 'unique-fuzzy'; course: Course; score: number; suggested: boolean }
  | { kind: 'ambiguous'; candidates: Array<{ course: Course; score: number }> }
  | { kind: 'no-match'; closest: Array<{ course: Course; score: number }> };

export function resolveCourse(
  input: string,
  courses: Course[],
  options: ResolverOptions
): Resolution {
  // 1. exact code or custom alias
  // 2. substring (≥3 chars) on code/name/alias
  // 3. fuzzy score over all
  //    - top-1 > 0.85 && delta > 0.30 → unique-fuzzy(suggested=true)
  //    - multiple high → ambiguous
  // 4. else → no-match with top 5
}
```

`lib/courses/fuzzy-score.ts` — hand-rolled scorer: returns 0..1.
Bonuses for: substring presence (+0.4), consecutive char run (+0.2),
acronym match (+0.15), starts-with bonus (+0.1), accent-folded match (+0.05).

`lib/courses/grouping.ts` — given Course[] from `/api/v1/courses`, groups by
`course_code` into LogicalCourse with `secciones[]`. Default presentation;
`--all` flattens.

`lib/courses/auto-alias.ts` — generates default alias from name:
1. Lowercase, strip accents, strip punctuation.
2. Split on spaces.
3. Skip stopwords (DE, LA, EL, II, III, IV, etc.).
4. Take first significant token.
5. If collision with existing alias → append next significant token or `2`/`3`/etc.

## Testing Strategy

**Unit (fast, no network)**:
- Every parser against real HTML fixture. Fixtures refreshed via `scripts/refresh-fixtures.ts`.
- Course resolver against synthetic course set covering every Resolution kind.
- Fuzzy score: snapshot tests against curated input/expected pairs.
- Section grouping: real Canvas response shape.
- Snapshot diff: synthetic before/after snapshots covering every `tipo`.

**Integration (mocked HTTP)**:
- 2-step intranet login: every `estado` branch (`"1"`, `"0"`, `"9"`, malformed).
- Canvas pagination: 3-page mock with `Link rel=next`.
- Auth-expired detection: response with `SiguNet.htm`.
- Rate-limit tracking: `X-Canvas-Meta` parsing.
- Concurrent `/assignments` fetch with concurrency cap.

**Live (manual, env-gated)**:
- `WIENER_LIVE_TEST=1 bun test tests/live/` — smoke pass against real portal.
- Asserts: `auth login` works, sample reads work, `auth logout` clears.
- Skipped in CI by default.

**Coverage targets**:
- Parsers: 100% (HTML can change silently).
- Course resolver: 100% (correctness-critical).
- Workflows: 80%.
- Output formatters: snapshot-tested.
- `commands/*`: no enforced coverage (thin glue).

## Build & Distribution

- `bun build --compile` → single binary (~50MB).
- v1: GitHub release tarball. No npm publish until v0.7.0.
- `scripts/install.sh` symlinks `bin/wiener` to `~/.local/bin/`.
- Linux build target via `build:linux` for non-macOS cron hosts.

## Implementation Order (recap from shaping)

| Day | Ship | Deliverable |
|---|---|---|
| 1 | scaffold | `auth login` + `auth canvas set-token` + course resolver + `cursos`/`cursos aliases` + `doctor` |
| 2 | v0.1.0 | intranet reads (`notas`, `horario`, `asistencia`, `plan`, `historial`, `examenes`, `matricula`, `perfil`, `pagos`, `tramite`) |
| 3 | v0.2.0 | Canvas core reads (`tareas`, `tareas hoy/semana/info`, `calificaciones`, `anuncios`, `modulos`, `archivos`, `archivos download`) |
| 4 | v0.4.0 | Canvas extras (`inbox`, `calendario`, `quizzes`, `discusiones`, `paginas`, `syllabus`, `conferencias`) |
| 5 | v0.5.0 | top-level `wiener` panorama + `wiener hoy/ahora/semana` + `planner` + output polish |
| 6 | v0.6.0 | `nuevo` + `watch` + macOS notif |
| 7 | v0.7.0 | smoke pass + bug bash + tag release |
