---
type: shaping
cli: wiener-cli
created: 2026-04-26
status: shaped
appetite: 4-6 days for v1 (intranet only), +2 days for Canvas v1.1
risk: LOW
source: "[[recon]]"
---

# wiener-cli — Shape

## Problem

Universidad Norbert Wiener spreads student information across two portals
(`intranet.uwiener.edu.pe` ASP + `campus.uwiener.edu.pe` Canvas) plus several
satellite domains. The actual day-to-day student questions — *"qué nota saqué",
"qué clase tengo ahora", "cuándo es el examen", "qué tareas debo entregar"* —
require multiple manual logins, navigating frame-based ASP menus, and clicking
through Canvas tabs. Both portals render data in HTML tables that are easy for
a CLI to parse and pipe.

The user is a Wiener Alumno (not Hunter himself; Hunter is automating for a
family member). Pain is concrete and recurring: every weekday someone asks
"what's my schedule today" or "did the prof post my grade yet" and the answer
takes 2-5 minutes of clicking. With a CLI: `wiener horario hoy` in 1 second.

## Appetite

**6 days for v1** (intranet read-only): auth + notas + horario + asistencia +
plan-de-estudios + JSON-everywhere + audit log. This is the 80% value.

**+2 days for v1.1** (Canvas read-only): courses + assignments + due-soon. Only
unblocks once Canvas access token is obtained manually.

**Kill criteria** (stop and reassess):
- `csrfToken` rotates per session — would force scraping every login. Doable
  but adds 1 day; reassess if scope creeps.
- Wiener migrates intranet to a JS SPA — current scraping approach dies, would
  need full rebuild against new endpoints. Probability low (legacy ASP, no
  signs of migration), but check before each release.
- MS Entra requires MFA for token generation — Canvas v1.1 path may need
  device-code OAuth flow instead, which is heavier; if so, defer Canvas to
  v2 and ship intranet-only.

## Command Surface

Convention: `wiener <noun> <verb>`. Most commands are read-only (T0). Anything
that writes through to Wiener (rare) or generates a payable order is T2.

### Auth

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener auth login` | T2 | Interactive intranet login (prompts for usuario/contraseña/perfil). Stores session. | `{ ok, perfil, expiresAt? }` |
| `wiener auth status` | T0 | Show current session state for both backends. | `{ intranet: { authed, user, sessionAgeMinutes }, canvas: { authed, tokenSet, lastCallAt? } }` |
| `wiener auth logout` | T0 | Destroy local session, call CerrarSesion.asp. | `{ ok }` |
| `wiener auth canvas set-token` | T2 | Set Canvas personal access token. Validates against `/api/v1/users/self`. | `{ ok, user: { id, name, primary_email } }` |
| `wiener auth canvas clear` | T0 | Remove stored Canvas token. | `{ ok }` |

### Académico — read

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener notas [--periodo 2026-I]` | T0 | Notas del periodo. Defaults to current. | `{ periodo, alumno: {...}, ponderado_acumulado, ponderado_historico, cursos: [{ codigo, nombre, ciclo, nota, modalidad }] }` |
| `wiener notas periodos` | T0 | List available periods (scraped from select options). | `{ periodos: ["2026-I", "2025-II", ...] }` |
| `wiener historial` | T0 | Historial académico completo. | `{ ciclos: [{ periodo, cursos: [...] }] }` |
| `wiener horario [--semana actual\|YYYY-WW]` | T0 | Horario matriculado, semana entera. | `{ semana, dias: { L: [bloques], M: [...], ... } }` where bloque = `{ time_start, time_end, course_code, course_name, section, type, room, building, attribute, teacher }` |
| `wiener horario hoy` | T0 | Solo bloques de hoy. | `{ fecha, dia, bloques: [...] }` |
| `wiener horario ahora` | T0 | Bloque(s) en este momento + próximo. | `{ ahora: bloque\|null, proximo: bloque\|null }` |
| `wiener asistencia [--curso COD]` | T0 | Asistencia por curso. | `{ cursos: [{ codigo, nombre, total_clases, asistencias, faltas, tardanzas, porcentaje }] }` |
| `wiener plan` | T0 | Plan de estudios completo. | `{ carrera, ciclos: [{ ciclo, cursos: [...] }] }` |
| `wiener plan avance` | T0 | Avance académico contra plan. | `{ creditos_aprobados, creditos_total, cursos_aprobados, cursos_pendientes, porcentaje }` |
| `wiener examenes` | T0 | Rol de exámenes próximos. | `{ examenes: [{ fecha, hora, curso, modalidad, aula }] }` |
| `wiener matricula` | T0 | Ficha de matrícula del periodo actual. | `{ periodo, ciclo, cursos: [...] }` |
| `wiener perfil` | T0 | Datos personales del estudiante. | `{ codigo, nombres, apellidos, dni, carrera, ... }` (REDACT-aware) |

### Pagos / trámites

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener pagos pendientes` | T0 | Obligaciones / deudas. | `{ total_pendiente, items: [{ concepto, monto, vencimiento, estado }] }` |
| `wiener pagos historial` | T0 | Pagos realizados (si la página los expone). | `{ pagos: [{ fecha, concepto, monto, recibo }] }` |
| `wiener tramite generar --tipo TIPO` | T2 | Genera orden de pago para un trámite. Muestra preview + monto, pide `--yes`. | `{ orden_id, monto, concepto, vencimiento }` |
| `wiener tramite list` | T0 | Trámites en curso del alumno. | `{ tramites: [{ id, tipo, estado, fecha_inicio }] }` |

### Canvas (v1.1, requires token)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener cursos` | T0 | Cursos activos en Canvas. | `{ cursos: [{ id, code, name, term, role }] }` |
| `wiener cursos info <id>` | T0 | Detalle de un curso. | `{ id, name, syllabus, teachers: [...], tabs: [...] }` |
| `wiener tareas [--curso ID] [--estado pending\|submitted\|graded]` | T0 | Tareas todas o por curso. | `{ tareas: [{ id, curso, name, due_at, points, submitted, graded, grade }] }` |
| `wiener tareas hoy` | T0 | Tareas con due_at hoy o atrasadas. | `{ atrasadas: [...], hoy: [...] }` |
| `wiener tareas semana` | T0 | Tareas de la semana en curso. | `{ tareas: [...] }` |
| `wiener tareas info <id>` | T0 | Detalle + descripción + rubric. | `{ id, name, description, due_at, rubric, submission }` |
| `wiener anuncios [--curso ID] [--ultimos N]` | T0 | Announcements. | `{ anuncios: [{ id, curso, title, posted_at, author, body }] }` |
| `wiener archivos [--curso ID]` | T0 | Listar archivos del curso. | `{ archivos: [{ id, name, size, modified_at, download_url }] }` |
| `wiener archivos download <id> [--out PATH]` | T0 | Descargar un archivo. | `{ ok, path, size }` |
| `wiener calendario [--dias N]` | T0 | Próximos eventos Canvas (N días, default 7). | `{ eventos: [{ fecha, tipo, titulo, curso }] }` |
| `wiener inbox [--no-leidos]` | T0 | Conversaciones Canvas. | `{ conversaciones: [{ id, from, subject, last_message_at, unread }] }` |

### Operativo

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener doctor` | T0 | Diagnóstico: red, intranet alive, Canvas alive, sesiones válidas, csrfToken sin cambios, dead-domain bug check. | `{ checks: [{ name, ok, detail }] }` |
| `wiener schema [comando]` | T0 | Imprime schema JSON de un comando (introspección para agentes). | `{ command, args, output_schema }` |
| `wiener config show` | T0 | Mostrar config actual (path, perfil, paths). | `{ ... }` |
| `wiener config path` | T0 | Imprime ruta del config dir. | `{ path }` |

## Trust Ladder

| Level | Name | Friction | Commands |
|-------|------|----------|----------|
| T0 | auto | None — runs silently | All read commands (`notas`, `horario`, `asistencia`, `cursos`, `tareas`, etc.) and `doctor`/`schema`/`config` |
| T1 | log | Audit-log only | (none — every write is T2 here) |
| T2 | confirm | Show preview, require `--yes` (or interactive confirm in TTY) | `auth login` (touches credentials), `auth canvas set-token`, `tramite generar` (creates a billable order), `archivos download` if file > 50MB |
| T3 | killswitch | Intent token + explicit confirm | (none — wiener-cli does not move money or destroy data) |

Justification for skipping T3: the highest-stakes write is generating a payment
order for a trámite, and that's already a T2 with explicit `--yes` because the
order creates a real S/. obligation in Wiener's billing system. There's no
"delete account" or "submit final grade" surface.

`auth login` is T2 (not T0) because it touches credentials — the user must
explicitly confirm "yes I want this CLI to hold my Wienernet session". After
that, all reads using the cached session are T0.

## Safety Rails

Low-stakes domain — no killswitch needed. Hard rules anyway:

- **Never write Wiener creds to disk in plaintext**. Store ASP cookie + Canvas
  token in OS keychain (`security` on macOS via `~/.kai/keychain` wrapper, or
  fall back to `~/.wiener/session.json` with `0600` perms only if keychain
  unavailable, with a loud warning).
- **No retry on auth failure**. If `autenticate.asp` returns `estado: "0"` once,
  abort and surface the message — do NOT retry; risk is account lockout.
- **No bulk write of `tramite generar`**. Even with `--yes`, refuse to run more
  than one `tramite generar` per minute. Stops accidental fan-out.
- **Logout on session-expiry detection**. If any read returns the
  "SiguNet.htm" / NXDOMAIN-redirect signature, clear the local session
  immediately and prompt re-auth — do NOT silently retry.

## Agent-First Design

Required for every command, regardless of domain stakes:

- **`--json`** flag on every command. Default is human-formatted (tables, color);
  `--json` emits a single JSON object to stdout, nothing else, exit code for
  status. Errors in `--json` mode emit `{ ok: false, error: { code, message, hint? } }` to stderr and exit 1.
- **`--dry-run`** for the 4 mutating commands (`auth login`, `auth canvas set-token`,
  `tramite generar`, `archivos download`). Returns `{ dryRun: true, input, status: "would-do" }`.
- **NDJSON streaming for paginated results**: `wiener tareas --ndjson` emits one
  JSON object per line for huge lists. Default `--json` returns a wrapped array.
- **`--params '<json>'` canonical input**: any command accepting flags also
  accepts `--params` with a JSON object. Sugar flags + `--params` → `--params`
  wins on conflict. Prevents agent flag-collision bugs.
- **`--fields a,b,c`** to project specific JSON keys (saves agent context).
- **`--no-input` flag**: forces non-interactive mode, no prompts, fail-fast on
  anything needing TTY. Auto-enabled when stdin not a TTY.
- **`wiener schema <command>`**: every command publishes its input/output JSON
  schema — agents introspect at runtime instead of relying on `--help`.
- **`wiener doctor --json`**: agents must run this before any real op when
  unsure of state. Returns structured ok/fail per check.
- **MCP surface (future)**: not v1. After CLI stabilizes, expose `notas`,
  `horario`, `tareas`, `calendario`, `anuncios` as MCP tools. Skip for now.

### --json contract examples

```jsonc
// wiener notas --periodo 2026-I --json
{
  "ok": true,
  "periodo": "2026-I",
  "alumno": {
    "codigo": "aXXXXXXXXX",
    "carrera": "Ingenieria de Software",
    "ciclo": 6
  },
  "ponderado_acumulado": 15.42,
  "ponderado_historico": 14.88,
  "orden_merito": 27,
  "cursos": [
    {
      "codigo": "AC4061",
      "nombre": "CIENCIA Y DESCUBRIMIENTO",
      "ciclo": 6,
      "creditos": 3,
      "nota_final": 17,
      "estado": "aprobado",
      "modalidad": "Virtual"
    }
  ]
}

// wiener horario hoy --json
{
  "ok": true,
  "fecha": "2026-04-27",
  "dia": "L",
  "bloques": [
    {
      "time_start": "07:00",
      "time_end": "10:00",
      "course_code": "AC4061",
      "course_name": "CIENCIA Y DESCUBRIMIENTO",
      "section": "AC6M28",
      "type": "Teoria",
      "room": "Remoto-Videoconf.",
      "building": "Sede Virtual",
      "attribute": "REGULAR",
      "teacher": "RAMIREZ, {REDACTED_NAME}"
    }
  ]
}
```

### Audit log format

`~/.wiener/audit.jsonl`, one JSON object per line:

```jsonc
{ "ts": "2026-04-26T18:42:13Z", "cmd": "notas", "args": { "periodo": "2026-I" }, "result": "ok", "duration_ms": 412, "rows": 7 }
{ "ts": "2026-04-26T18:43:02Z", "cmd": "tramite generar", "args": { "tipo": "constancia" }, "result": "ok", "duration_ms": 1850, "orden_id": "OP-2026-12345", "monto": 30 }
```

T2 commands always log; T0 commands log only when `--verbose` is set (avoid log
explosion for cron-driven `horario ahora` checks).

## Rabbit Holes

Things that are tempting but not v1:

- **Programmatic SAML2 / Entra dance**: brittle, anti-pattern, replace with
  manual token + `--canvas-token` flag.
- **Matricula portal automation**: `matricula.uwiener.edu.pe` lets you re-pick
  courses at semester start. High-stakes (locks your schedule for 4 months) and
  recon-only-once-per-year value. Defer to v2 if ever.
- **Pagos:8443 banking integration**: payments portal. Real money, T3 territory.
  Out of scope — let the user pay through their bank app.
- **Sofydoc tracking**: trámites long-tail tracking. Separate domain, separate
  auth, low frequency. Defer.
- **Notifications / cron scheduling**: building a "notify me when grade
  arrives" feature is its own product. Compose externally with `cron + wiener
  notas --json + diff`. CLI just provides the data.
- **Web UI / dashboard**: this is a CLI. If a UI is wanted, build it on top
  consuming the JSON output.
- **TUI / interactive picker**: nice to have for `tareas info <id>`, but
  not v1. JSON output is enough for agents.
- **OCR of carné universitario / boleta de pago**: not the CLI's job.

## No-Gos

Hard boundaries this CLI will never cross:

- **Will not store Wiener passwords on disk**. Only ASP cookie + Canvas token.
  Password is prompt-only during `auth login`, lives in memory until request,
  then is dropped.
- **Will not auto-execute `tramite generar`** without explicit `--yes` or
  interactive confirm. Even agents must pass `--yes` after preview.
- **Will not pay anything**. No banking integration. Generates orders, never
  pays them.
- **Will not modify grades, attendance, or any academic record**. Read-only on
  academic data. (The portal doesn't allow it anyway, this is a defense-in-depth
  rule.)
- **Will not bypass Microsoft Entra MFA** or attempt to automate Entra login
  flows. If a user's MS account requires MFA, Canvas access requires manual
  token generation, period.
- **Will not scrape / archive other students' data**. Only the authenticated
  user's own records. (No bulk-download of class roster info beyond what
  Canvas's own UI shows.)
- **Will not disable TLS verification** under any flag. Wiener's certs work,
  there's no excuse.

## Open Questions

Carryover from recon, will resolve during implementation:

1. **Are Canvas access tokens enabled for Wiener students?** Need MS Entra
   credentials to verify. If disabled, Canvas v1.1 must use cookie-extraction
   fallback or be deferred entirely.
2. **Does `csrfToken=9144AF7` rotate?** Implementation will scrape it every
   session anyway — solves both cases. Worth a monthly external probe.
3. **What does the Notas page POST/GET need to switch periods?** Recon saw the
   selector but didn't trigger a change. Implementation will reverse that.
4. **What are the exact field names in `pagos/obligaciones.asp`?** Recon didn't
   land there. Will need a 30-min browser session during implementation.
5. **Is `tramite generar` actually an XHR or a form POST?** Recon noted the
   path but didn't exercise it. Will need test of a free trámite (constancia
   simple) to map the flow.
