---
type: scaffold
cli: wiener-cli
created: 2026-04-26
source: "[[shaping]]"
---

# wiener-cli — Scaffold

## Directory Structure

```
wiener-cli/
├── package.json
├── tsconfig.json
├── biome.json
├── bunfig.toml
├── README.md
├── src/
│   ├── cli.ts                          # entrypoint, commander setup
│   ├── commands/
│   │   ├── auth.ts                     # login, status, logout, canvas set-token, canvas clear
│   │   ├── notas.ts                    # notas, notas periodos
│   │   ├── horario.ts                  # horario, horario hoy, horario ahora
│   │   ├── asistencia.ts               # asistencia
│   │   ├── plan.ts                     # plan, plan avance
│   │   ├── historial.ts                # historial
│   │   ├── examenes.ts                 # examenes
│   │   ├── matricula.ts                # matricula, perfil
│   │   ├── pagos.ts                    # pagos pendientes, pagos historial
│   │   ├── tramite.ts                  # tramite generar, tramite list
│   │   ├── cursos.ts                   # canvas: cursos, cursos info
│   │   ├── tareas.ts                   # canvas: tareas, tareas hoy/semana, tareas info
│   │   ├── anuncios.ts                 # canvas: anuncios
│   │   ├── archivos.ts                 # canvas: archivos, archivos download
│   │   ├── calendario.ts               # canvas: calendario
│   │   ├── inbox.ts                    # canvas: inbox
│   │   ├── doctor.ts                   # diagnostic
│   │   ├── schema.ts                   # introspection
│   │   └── config.ts                   # config show, config path
│   ├── lib/
│   │   ├── workflows/                  # high-level orchestrations
│   │   │   ├── intranet-login.ts       # 2-step XHR + form-post dance
│   │   │   ├── canvas-list.ts          # paginated Canvas list helper
│   │   │   └── doctor-checks.ts        # composed diagnostic
│   │   ├── api/
│   │   │   ├── intranet/
│   │   │   │   ├── client.ts           # HTTP client w/ ASP cookie management
│   │   │   │   ├── login.ts            # autenticate.asp + ValidaAcceso.asp
│   │   │   │   ├── notas.ts            # GET + parse NOTAS.asp
│   │   │   │   ├── horario.ts          # GET + parse horario.asp
│   │   │   │   ├── asistencia.ts       # GET + parse asistencia.asp
│   │   │   │   ├── plan.ts             # GET + parse plandeEstudio.asp
│   │   │   │   ├── pagos.ts            # GET + parse obligaciones.asp
│   │   │   │   └── tramite.ts          # POST orden_pago.asp
│   │   │   └── canvas/
│   │   │       ├── client.ts           # fetch wrapper, Bearer auth, rate-limit tracking, pagination
│   │   │       ├── courses.ts          # /courses endpoints
│   │   │       ├── assignments.ts      # /assignments endpoints
│   │   │       ├── announcements.ts    # /announcements
│   │   │       ├── files.ts            # /files
│   │   │       ├── calendar.ts         # /upcoming_events, /todo
│   │   │       └── conversations.ts    # /conversations
│   │   ├── parsers/
│   │   │   ├── notas-table.ts          # cheerio HTML table parser
│   │   │   ├── horario-table.ts        # 7-col schedule grid parser
│   │   │   ├── asistencia-table.ts
│   │   │   ├── plan-table.ts
│   │   │   ├── pagos-table.ts
│   │   │   └── csrf-token.ts           # scrape csrfToken from sso.asp
│   │   ├── validation/
│   │   │   ├── schemas.ts              # zod schemas for each command's I/O
│   │   │   └── inputs.ts               # input validators (periodo format, course_code, etc.)
│   │   ├── auth/
│   │   │   ├── store.ts                # session/token persist (keychain-first, file fallback)
│   │   │   ├── keychain-mac.ts         # macOS Keychain wrapper via `security` cmd
│   │   │   └── prompt.ts               # @clack/prompts for interactive credential entry
│   │   ├── output/
│   │   │   ├── json.ts                 # canonical JSON envelope
│   │   │   ├── ndjson.ts               # streaming output
│   │   │   ├── human.ts                # table/colored output (uses cli-table3, picocolors)
│   │   │   └── fields.ts               # --fields projection
│   │   ├── audit/
│   │   │   └── log.ts                  # JSONL append to ~/.wiener/audit.jsonl
│   │   ├── errors.ts                   # typed error hierarchy + exit codes
│   │   ├── env.ts                      # WIENER_* env var reader
│   │   ├── tty.ts                      # is-tty checks, --no-input enforcement
│   │   └── version.ts                  # auto-injected from package.json
│   └── types/
│       ├── intranet.ts                 # Periodo, Nota, Horario types
│       ├── canvas.ts                   # mirror of Canvas API response shapes
│       └── config.ts                   # config file shape
├── tests/
│   ├── parsers/
│   │   ├── notas.test.ts               # against fixture HTML
│   │   ├── horario.test.ts
│   │   └── csrf-token.test.ts
│   ├── api/
│   │   ├── intranet-login.test.ts      # mock the 2-step dance
│   │   └── canvas-pagination.test.ts   # mock Link header
│   ├── output/
│   │   └── json-contract.test.ts       # snapshot every command's --json shape
│   ├── auth/
│   │   └── store.test.ts               # keychain + file fallback
│   └── fixtures/
│       ├── sso-asp-page.html
│       ├── notas-2026-I.html
│       ├── horario-week.html
│       ├── obligaciones.html
│       └── canvas-courses.json
└── scripts/
    └── refresh-fixtures.ts             # re-fetch HTML fixtures from live portal (manual)
```

## package.json

```json
{
  "name": "@railly/wiener-cli",
  "version": "0.1.0",
  "private": true,
  "description": "Agent-first CLI for Universidad Norbert Wiener student portals (intranet + Canvas LMS).",
  "type": "module",
  "bin": {
    "wiener": "./bin/wiener"
  },
  "files": ["bin/", "dist/"],
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile bin/wiener --target=bun-darwin-arm64",
    "build:linux": "bun build src/cli.ts --compile --outfile bin/wiener-linux --target=bun-linux-x64",
    "test": "bun test",
    "test:watch": "bun test --watch",
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

Notes on choices:
- **Bun runtime + `bun build --compile`** — single static binary, no Node
  required on the user's machine. Same approach as hapi-cli, sunat-cli, trx.
- **commander over yargs** — same as hapi-cli/sunat-cli, consistent ergonomics.
- **@clack/prompts** — pretty interactive prompts for `auth login` only; never
  in `--no-input` paths.
- **cheerio** — HTML parsing for ASP pages. jQuery-like API.
- **zod v4** — runtime validation + TypeScript inference for schemas.
- **No node-fetch / undici** — Bun's built-in `fetch` handles cookies fine via
  `tough-cookie` jar (or `Headers` `Cookie` manual mgmt; we'll do manual to
  stay zero-dep on cookie handling).

## Global Flags (every command)

| Flag | Purpose |
|------|---------|
| `--json` | Machine-parseable JSON to stdout. Disables color/prompts. |
| `--ndjson` | One JSON object per line (paginated results) |
| `--dry-run` | For T2 mutations: print what would happen, exit 0. |
| `--verbose` | Detailed logging to stderr (audit.jsonl always written). |
| `--quiet` | Suppress all stderr. |
| `--no-input` | Force non-interactive (auto-enabled if !isTTY(stdin)). |
| `--yes` | Skip T2 confirmations. |
| `--fields a,b,c` | Project only specified keys in JSON output. |
| `--params '<json>'` | Canonical input override (wins over sugar flags). |
| `--config PATH` | Override config dir (default `~/.wiener`). |
| `--profile NAME` | Use named profile from config (for multi-account future). |
| `--help`, `-h` | Help. |
| `--version`, `-v` | Version. |

## Auth Strategy

**Two backends, two storage strategies:**

### Intranet (ASP cookie session)

- Storage: macOS Keychain item `wiener-cli.intranet.<profile>` containing JSON
  `{ aspCookieName, aspCookieValue, perfil, capturedAt, codigo }`.
  Linux fallback: `~/.wiener/<profile>/intranet-session.json`, `0600` perms.
- Lifecycle:
  - `auth login` runs the 2-step dance, captures the `Set-Cookie` from
    `ValidaAcceso.asp`, stores immediately.
  - Every command uses the cookie. On any response indicating expiry (HTML
    contains `SiguNet.htm` redirect, or status 302 to `sso.asp`), wipe the
    stored session and prompt re-auth (or fail with `error.code = "auth-expired"`
    if `--no-input`).
  - `auth logout` calls `/CerrarSesion.asp?p=alu`, then wipes local session.
- Password: NEVER stored. Prompted during `auth login` only, held in memory for
  the single request, then garbage-collected.

### Canvas (Bearer token)

- Storage: macOS Keychain item `wiener-cli.canvas.<profile>` containing JSON
  `{ token, validatedAt, userId, primaryEmail }`. File fallback same pattern.
- Lifecycle:
  - `auth canvas set-token <token>` validates against
    `GET /api/v1/users/self`, stores on success.
  - Every Canvas command sends `Authorization: Bearer <token>`.
  - On 401: clear stored token, surface `error.code = "canvas-token-invalid"`,
    instruct user to regenerate at `/profile/settings`.
- Token never expires server-side unless revoked, but we re-validate weekly via
  background check or on first call of the day.

### Env var override (CI/automation)

- `WIENER_INTRANET_USER`, `WIENER_INTRANET_PASS`, `WIENER_INTRANET_PERFIL=A` —
  if set and no session exists, `wiener` will auto-login on first command. Useful
  for cron scripts. Treat as bootstrap only; session caching still applies.
- `WIENER_CANVAS_TOKEN` — overrides stored Canvas token for the current
  invocation.
- `WIENER_PROFILE` — sets default profile name.

## State Management

```
~/.wiener/
├── config.json                          # global config (default profile, log level)
├── audit.jsonl                          # append-only audit (all T2 + verbose T0)
├── default/                             # default profile dir
│   ├── intranet-session.json            # only if keychain unavailable, 0600
│   ├── canvas-session.json              # only if keychain unavailable, 0600
│   ├── csrf-token.json                  # last-seen csrfToken, for staleness detection
│   ├── periodos-cache.json              # cached periodo list, refreshed weekly
│   └── doctor-last.json                 # last doctor run results
└── fixtures-cache/                      # raw HTML responses if --debug-html, optional
```

`config.json` shape:
```json
{
  "version": 1,
  "default_profile": "default",
  "log_level": "info",
  "log_t0_commands": false,
  "intranet": {
    "base_url": "https://intranet.uwiener.edu.pe",
    "request_timeout_ms": 15000,
    "user_agent": "wiener-cli/0.1.0 (+https://github.com/Railly/wiener-cli)"
  },
  "canvas": {
    "base_url": "https://campus.uwiener.edu.pe",
    "per_page": 100,
    "request_timeout_ms": 30000
  }
}
```

## Testing Strategy

**Unit (fast, no network):**
- Every parser against a real HTML fixture in `tests/fixtures/`. Fixtures are
  refreshed by `scripts/refresh-fixtures.ts` (manual, requires authed session).
- JSON envelope contract — snapshot test ensures `{ ok, ... }` shape never
  silently regresses.
- CSRF token scraper — fixture of `sso.asp` page, asserts `9144AF7` extracted.

**Integration (mocked HTTP):**
- 2-step intranet login flow against fake `autenticate.asp` + `ValidaAcceso.asp`
  responders. Cover all `estado` branches (`"1"`, `"0"`, `"9"`, malformed JSON).
- Canvas pagination — fake server returning 3 pages with `Link: rel="next"`,
  assert all collected.
- Auth-expiry detection — fake response containing `SiguNet.htm`, assert
  session wiped + correct error code.
- Rate-limit tracking — fake `X-Canvas-Meta` headers, assert counter visible
  in verbose mode.

**Live (manual, gated by env var):**
- `WIENER_LIVE_TEST=1 bun test tests/live/` — runs a smoke pass against the
  real portal using credentials from env. Skipped in CI by default.
- Asserts: `auth login` succeeds, `notas`/`horario`/`asistencia` return `ok: true`
  with expected shape, `auth logout` clears session.

**Coverage targets:**
- Parsers: 100% (the riskiest layer — HTML can change shape silently).
- Workflows: 80%.
- Output formatters: snapshot-tested.
- No coverage enforced on `commands/*` — those are thin glue.

## Build & Distribution

- `bun build --compile` produces a single binary (~50MB).
- Distribution v1: GitHub release tarball. No npm publish until shape settles.
- Path setup: `bin/wiener` symlinked into `~/.local/bin/` by an install script
  in `scripts/install.sh`.
- Linux build target added in `build:linux` for any cron host that's not macOS.

## Implementation Order

Suggested 6-day path:

1. **Day 1**: project scaffold + `auth login/logout/status` + intranet client
   + cookie storage (keychain). `wiener doctor` skeleton.
2. **Day 2**: `notas` + `horario` + parsers + fixture tests. Ship as v0.1.0.
3. **Day 3**: `asistencia` + `plan` + `examenes` + `historial`. Ship as v0.2.0.
4. **Day 4**: `pagos` + `tramite` (T2 + audit). `schema` introspection. Ship v0.3.0.
5. **Day 5**: JSON output polish, NDJSON streaming, `--fields`, `--params`,
   error envelopes. Snapshot tests for every command. Ship v0.4.0.
6. **Day 6**: Real-world smoke pass with Hunter's family member. Bug bash. Ship v0.5.0.

After v0.5.0 stabilizes (~1 week of usage), tackle Canvas v1.1 (assumes Canvas
token has been obtained manually). Allow 2 days for that pass.
