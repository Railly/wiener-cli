---
type: shaping
cli: wiener-cli
created: 2026-04-26
status: shaped (v2 — student-first redesign post-Canvas-recon)
appetite: 5-7 days for v1 (intranet + Canvas read-only via PAT), +2 days for advanced (planner, watch, nuevo)
risk: LOW
source: "[[recon]] [[recon-canvas]]"
---

# wiener-cli — Shape (v2, student-first)

## Problem

Universidad Norbert Wiener spreads student information across two portals
(`intranet.uwiener.edu.pe` ASP + `campus.uwiener.edu.pe` Canvas) plus several
satellite domains. The day-to-day student questions — *"qué tengo hoy", "qué
debo entregar", "cómo voy en X", "qué subió el profe", "tengo deuda?"* —
require multiple manual logins, jerárquica navigation, and the Canvas UI is
**lockdown-customized by Wiener admin**: 7 tabs (Tareas, Discusiones, Páginas,
Archivos, Quizzes, Conferencias, Programa del curso) are hidden from the
student sidebar. Students reach assignments by drilling into Modules week by
week. There is no "all PDFs of this course" view. There is no "all assignments
across courses due this week" view.

The Canvas REST API at `/api/v1/*` exposes ALL of this — Wiener locked down the
UI but not the API. Personal Access Token generation is enabled for students.
This CLI surfaces what the UI hides, in the form a student actually thinks in.

The user is a Wiener Alumno (Hunter automating for a family member, account
`aXXXXXXXXX`). Pain is concrete and recurring: every weekday someone asks
"what's my schedule today" or "did the prof post my grade yet" or "what files
did the prof upload this week" and the answer takes 2-10 minutes of clicking.
With this CLI: `wiener` (no args) → full panorama in 1 second.

## Appetite

**5-7 days for v1** (intranet + Canvas read-only, all hidden surfaces unlocked):
- Day 1: scaffold + `auth login` (intranet) + `auth canvas set-token` + course
  resolver lib + `cursos`/`cursos aliases` + `doctor`.
- Day 2: intranet reads — `notas`, `horario`, `asistencia`, `plan`, `historial`,
  `examenes`, `matricula`, `perfil`, `pagos`, `tramite`.
- Day 3: Canvas reads — `tareas`, `tareas hoy/semana/info`, `calificaciones`,
  `anuncios`, `modulos`, `archivos`, `archivos download`.
- Day 4: Canvas extras — `inbox`, `calendario`, `calendario --ics`, `quizzes`,
  `discusiones`, `paginas`, `syllabus`, `conferencias`.
- Day 5: top-level `wiener` panorama, `wiener hoy`, `wiener planner`, schema,
  output polish (color tables, json, ndjson, fields, params).
- Day 6: `wiener nuevo` (diff state) + `wiener watch` (background + macOS notif).
- Day 7: smoke pass with the actual student, bug bash, ship v0.7.0.

**Kill criteria** (stop and reassess):
- PAT generation gets disabled by Wiener admin → fall back to manual cookie
  extraction docs. Doable but painful, 1 day extra.
- `csrfToken=9144AF7` rotates per-session → re-scrape every login. +half day.
- Wiener migrates intranet to JS SPA → full rebuild against new endpoints.
  Probability low (legacy ASP unchanged for years).
- Canvas API rate-limit (`rlr=`) drops below 100 in normal usage → add
  aggressive caching, +1 day.

## North Star Interaction

What `wiener` solo does (no args, the most common invocation):

```
$ wiener

Hoy — Lunes 27 abril 2026
─────────────────────────

  Ahora        ─ AC6M28 · CIENCIA Y DESCUBRIMIENTO
                 07:00 - 10:00 · Remoto-Videoconf · Prof. {Apellido}, {Nombre}

  Próximo      ─ FB6M4 · LABORATORIO Y DIAGNÓSTICO II  (en 1h 23m)
                 11:30 - 14:00 · Aula 305 · Prof. {Apellido2}, {Nombre2}

Pendiente hoy
─────────────

  ⚡ ENTREGA   FB6N1  Informe semanal UD2          venc. 23:00 (en 4h)
  ○ tarea     AC6M28 Foro: ética científica       venc. 23:59 (en 5h)
  ○ quiz      FB6N2  Autoevaluación módulo 3      venc. mañana 08:00

Esta semana
───────────

  3 tareas más con vencimiento (ver: wiener tareas semana)
  2 quizzes  (ver: wiener quizzes)

Cambios desde tu última corrida (hace 6h)
─────────────────────────────────────────

  ✦ Nueva calificación  AC6M28 Práctica calificada 1: 17/20
  ✦ Nuevo anuncio       FB6M4 "Cambio de aula sesión jueves"
  ✦ Nuevo archivo       FB6N1 Tema-04-farmacocinetica.pdf  (12 MB)

  → wiener nuevo --abrir   para ver detalles
```

Density and student-mental-model first. Color: ENTREGA en rojo, próximo en
amarillo, cambios en cyan. `--json` flag flattens this to a single structured
object.

## Course Resolver (the alias system)

Mental model: students don't type course IDs (131067) and they get tired of
codes (FB6N1). They want to type what they remember.

### Resolution order — first hit wins

1. **Exact match** on `course_code` (`FB6N1`) or custom alias.
2. **Substring match** (≥3 chars, case-insensitive) on `course_code`, `name`,
   or alias. Single match → execute. Multiple matches → list and ask.
3. **Fuzzy score** (substring + char-order + position bonuses) over code+name+alias.
   - Top-1 score > 0.85 AND delta-to-top-2 > 0.3 → confirm via clack:
     `¿Quisiste decir farma (FB6N1 — TERAPÉUTICA FARMACOLÓGICA III)? [Enter / Esc]`
   - Multiple high-score candidates → table + ask to pick.
4. **No reasonable match** (top-1 score < 0.5) → error with **top 5 fuzzy
   candidates regardless of score** + tip pointing to `wiener cursos`.

### Behavior in non-interactive mode (`--json` or `--no-input`)

- No clack prompts ever.
- Top-1 score > 0.92 → execute directly.
- Otherwise → exit 1 with `{ ok: false, error: { code: "course-ambiguous", message, candidates: [{code, name, alias, score}, ...] } }` to stderr.

### Override flag

- `--exact` forces exact match only (no fuzzy, no substring). For paranoid
  scripts that want stable behavior across roster changes.

### Aliases

**Default**: every course gets an auto-alias = first significant word of the
name, lowercased, accents stripped, deduplicated by appending a counter if
needed. E.g.:

| code | name | auto-alias |
|---|---|---|
| FB6N1 | TERAPÉUTICA FARMACOLÓGICA III | terapeutica |
| FB6N2 (FARMACIA CLÍNICA I) | FARMACIA CLÍNICA I | farmacia |
| FB6N2 (PREPARACIONES FARMACÉUTICAS) | PREPARACIONES FARMACÉUTICAS | preparaciones |
| FB6M4 | LABORATORIO Y DIAGNÓSTICO II | laboratorio |
| AC6M28 | CIENCIA Y DESCUBRIMIENTO | ciencia |

**Wizard** to customize: `wiener cursos aliases` walks course-by-course with
clack/prompts:

```
$ wiener cursos aliases

Configurando aliases (Enter para mantener actual, Ctrl+C salir).

[1/8] AC6M28 — CIENCIA Y DESCUBRIMIENTO
      Alias actual: ciencia
      ◇ Nuevo alias: ▏ciencia▏

[2/8] FB6M4 — LABORATORIO Y DIAGNÓSTICO II (T+PD)
      Alias actual: laboratorio
      ◇ Nuevo alias: ▏labo▏

...

✓ 4 aliases personalizados, 4 mantenidos en default
  Guardado en ~/.wiener/aliases.json
```

Persisted to `~/.wiener/aliases.json` (per profile). Reset one with
`wiener cursos aliases reset <code>`. List all with `wiener cursos aliases list`.

### Section grouping (T/P/PD)

Each Wiener course splits into theory + practice as separate Canvas courses
with the same `course_code` (e.g. FB6M4 has `-T` and `-PD`, FB6N1 has `-T` and
`-P1`). 11 Canvas courses → 8 logical courses for the student.

**Default**: `wiener tareas labo` returns merged tareas across all sections,
with a `seccion` column to distinguish. Same for `archivos`, `anuncios`,
`modulos`, `calificaciones`.

**Filter by section**: `wiener tareas labo --seccion T` or `--seccion PD`.
Only one `--seccion` flag at a time.

`wiener cursos` shows grouped by default (8 rows), `--all` expands to 11.

## Command Surface

Top-level plano = primary surface. Mirror namespaces (`wiener intranet *`,
`wiener canvas *`) provided for `--help` filtering and disambiguation.

### Top-level (default + alias-friendly)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener` | T0 | "Hoy" panorama: schedule + pending today + week summary + recent diffs. | `{ hoy, ahora, proximo, pendiente_hoy, esta_semana, nuevo: { ... } }` |
| `wiener hoy` | T0 | Solo bloque de hoy + tareas hoy. Sin diffs. | `{ fecha, dia, bloques: [...], tareas_hoy: [...] }` |
| `wiener ahora` | T0 | Bloque actual + próximo. | `{ ahora: bloque\|null, proximo: bloque\|null, eta_minutos? }` |
| `wiener semana` | T0 | Schedule semana + tareas semana + quizzes semana. | `{ semana, dias: { L: [...], ... }, tareas: [...], quizzes: [...] }` |
| `wiener nuevo` | T0 | Diff desde última corrida (anuncios, archivos, calificaciones, tareas, módulos). | `{ desde, items: [{ tipo, curso, titulo, detalle, url }] }` |
| `wiener nuevo --abrir` | T0 | Mismo + abre cada item en browser. | (same) |
| `wiener watch` | T0 | Background loop: cada 30 min ejecuta diff y manda macOS notif si hay cambios. Ctrl+C para parar. | streaming NDJSON of diff events |
| `wiener doctor` | T0 | Health check ambos backends + auth + csrfToken stable + sample API call. | `{ ok, checks: [{ name, ok, detail }] }` |
| `wiener schema [comando]` | T0 | Schema JSON de un comando (introspection). | `{ command, args, output_schema }` |
| `wiener config show` | T0 | Config + paths actuales. | `{ ... }` |

### Auth

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener auth login` | T2 | Interactive intranet login (clack: usuario/contraseña/perfil). | `{ ok, perfil, codigo, expiresAt? }` |
| `wiener auth status` | T0 | Estado de ambos backends. | `{ intranet: {...}, canvas: {...} }` |
| `wiener auth logout` | T0 | CerrarSesion.asp + wipe local. Canvas opcional `--canvas` para revoke PAT. | `{ ok }` |
| `wiener auth canvas set-token <pat>` | T2 | Valida con `/api/v1/users/self`, guarda. | `{ ok, user: { id, name } }` |
| `wiener auth canvas pat new` | T2 | Abre `/profile/settings` + instrucciones paste-back. | `{ url_opened, hint }` |
| `wiener auth canvas clear` | T0 | Borra PAT local. | `{ ok }` |

### Cursos

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener cursos [--all]` | T0 | Lista cursos (agrupado por code default; `--all` 1 row per Canvas course). | `{ cursos: [{ code, name, alias, secciones: [{ id, seccion, name }], term, role }] }` |
| `wiener cursos info <ref>` | T0 | Detalle de un curso. | `{ code, name, alias, secciones: [...], teachers, sidebar_tabs_visible, sidebar_tabs_hidden, lti_tools }` |
| `wiener cursos abrir <ref>` | T0 | Abre `/courses/{id}` en browser default (para LTI: Microsoft Education, IgniteAI). | `{ ok, url_opened }` |
| `wiener cursos aliases` | T2 | Wizard interactivo. | `{ ok, aliases: { code: alias, ... } }` |
| `wiener cursos aliases list` | T0 | Tabla actual. | `{ aliases: [...] }` |
| `wiener cursos aliases reset <code>` | T0 | Vuelve a auto. | `{ ok }` |
| `wiener cursos favoritos` | T0 | Solo cursos favoriteados en Canvas. | `{ cursos: [...] }` |

### Tareas (UI hidden — API-backed)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener tareas` | T0 | Todas las tareas pendientes en todos los cursos activos. | `{ tareas: [{ id, curso: { code, alias, seccion }, name, due_at, points, submitted, graded, grade, url }] }` |
| `wiener tareas <ref>` | T0 | Tareas de un curso (todas las secciones por default). | `{ curso, tareas: [...] }` |
| `wiener tareas hoy` | T0 | Vencen hoy o están atrasadas. | `{ atrasadas: [...], hoy: [...] }` |
| `wiener tareas semana` | T0 | Vencen en próximos 7 días. | `{ tareas: [...] }` |
| `wiener tareas info <id>` | T0 | Detalle + descripción + rubric + tu submission. | `{ id, name, description, due_at, rubric, submission, points }` |
| `wiener planner` | T0 | `/api/v1/planner/items` — el data behind dashboard list view, con flags missing/late/ignored. Más rico que `tareas`. | `{ items: [{ plannable_type, plannable, planner_override, submissions, ... }] }` |

### Calificaciones (parcial UI, completo API)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener calificaciones` | T0 | Vista cross-curso: nota actual (current_grade) por cada curso. | `{ cursos: [{ code, alias, current_grade, current_score, final_grade?, final_score? }] }` |
| `wiener calificaciones <ref>` | T0 | Detalle por curso: cada submission con nota. | `{ curso, submissions: [{ assignment, score, grade, posted_at, comments }] }` |
| `wiener notas` | T0 | (intranet) Notas oficiales por periodo. Distinto a Canvas: estas son las que cuentan. | `{ periodo, alumno, ponderado_acumulado, ponderado_historico, orden_merito, cursos: [...] }` |
| `wiener notas periodos` | T0 | Periodos disponibles. | `{ periodos: [...] }` |
| `wiener notas --periodo 2025-II` | T0 | Notas de periodo histórico. | (same) |
| `wiener historial` | T0 | (intranet) Historial académico completo. | `{ ciclos: [...] }` |

### Horario, asistencia, plan (intranet)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener horario` | T0 | Semana matriculada. | `{ semana, dias: { L: [bloques], ... } }` where bloque = `{ time_start, time_end, course_code, course_name, section, type, room, building, teacher }` |
| `wiener horario hoy` | T0 | Bloques hoy. | `{ fecha, bloques: [...] }` |
| `wiener horario ahora` | T0 | Bloque actual + próximo. | `{ ahora, proximo, eta_minutos }` |
| `wiener asistencia [--curso <ref>]` | T0 | Asistencia por curso. | `{ cursos: [{ code, total_clases, asistencias, faltas, tardanzas, porcentaje }] }` |
| `wiener plan` | T0 | Plan de estudios completo. | `{ carrera, ciclos: [...] }` |
| `wiener plan avance` | T0 | Avance vs plan. | `{ creditos_aprobados, creditos_total, cursos_aprobados, cursos_pendientes, porcentaje }` |
| `wiener examenes` | T0 | Rol de exámenes próximos. | `{ examenes: [{ fecha, hora, curso, modalidad, aula }] }` |
| `wiener matricula` | T0 | Ficha de matrícula actual. | `{ periodo, ciclo, cursos: [...] }` |
| `wiener perfil` | T0 | Datos del estudiante. | `{ codigo, nombres, carrera, ... }` |

### Anuncios, archivos, módulos (UI hidden — Canvas API)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener anuncios [--ultimos N]` | T0 | Anuncios cross-curso (últimos N por curso). | `{ anuncios: [{ id, curso, title, posted_at, author, body }] }` |
| `wiener anuncios <ref>` | T0 | Anuncios de un curso. | `{ curso, anuncios: [...] }` |
| `wiener anuncios globales` | T0 | EEGG + institucionales del dashboard. | `{ anuncios: [...] }` |
| `wiener archivos <ref>` | T0 | Listado plano de TODOS los archivos del curso (UI esconde esto). | `{ curso, archivos: [{ id, name, path, size, modified_at, download_url }] }` |
| `wiener archivos arbol <ref>` | T0 | Árbol de carpetas/archivos. | `{ curso, root: { folders, files } }` |
| `wiener archivos download <id> [--out PATH]` | T2 si >50MB | Descarga 1 archivo. | `{ ok, path, size }` |
| `wiener archivos sync <ref> [--dir PATH]` | T2 | Descarga masiva del curso. Confirma cantidad + tamaño antes. | `{ ok, total, downloaded, skipped }` |
| `wiener modulos <ref>` | T0 | Módulos del curso con items. | `{ curso, modulos: [{ id, name, items: [{ type, title, url }] }] }` |
| `wiener syllabus <ref>` | T0 | Syllabus_body del curso. | `{ curso, syllabus_html, syllabus_text }` |
| `wiener paginas <ref>` | T0 | Wiki pages del curso. | `{ paginas: [{ url, title, body, updated_at }] }` |
| `wiener discusiones <ref>` | T0 | Foros + tu participación. | `{ discusiones: [...] }` |
| `wiener quizzes <ref>` | T0 | Quizzes del curso (UI esconde). | `{ quizzes: [{ id, title, due_at, time_limit, allowed_attempts, status }] }` |
| `wiener conferencias <ref>` | T0 | BBB/Zoom históricos del curso. | `{ conferencias: [...] }` |

### Calendario, inbox

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener calendario [--dias N]` | T0 | Eventos próximos (default 7 días). | `{ eventos: [{ fecha, tipo, titulo, curso }] }` |
| `wiener calendario --ics [--out PATH]` | T0 | Descarga ICS de todos los cursos a un solo archivo. | `{ ok, path, eventos }` |
| `wiener calendario --ics --curso <ref>` | T0 | ICS de un solo curso (anonymous URL). | `{ ok, path, url }` |
| `wiener inbox [--no-leidos]` | T0 | Conversaciones Canvas. | `{ conversaciones: [{ id, from, subject, last_message_at, unread, count }] }` |
| `wiener inbox info <id>` | T0 | Mensajes de una conversación. | `{ conversacion, mensajes: [...] }` |

### Pagos / trámites (intranet)

| Command | Trust | Description | JSON Output |
|---------|-------|-------------|-------------|
| `wiener pagos` | T0 | Obligaciones / deudas. | `{ total_pendiente, items: [{ concepto, monto, vencimiento, estado }] }` |
| `wiener pagos historial` | T0 | Pagos realizados. | `{ pagos: [...] }` |
| `wiener tramite list` | T0 | Trámites en curso. | `{ tramites: [{ id, tipo, estado, fecha_inicio }] }` |
| `wiener tramite generar --tipo TIPO` | T2 | Genera orden de pago. Preview + monto + `--yes`. | `{ orden_id, monto, concepto, vencimiento }` |

### Mirror namespaces (espejo, mismo backend)

`wiener intranet *` — solo expone subset de comandos backed by intranet:
`auth login`, `auth logout`, `notas`, `historial`, `horario`, `asistencia`,
`plan`, `examenes`, `matricula`, `perfil`, `pagos`, `tramite`.

`wiener canvas *` — solo Canvas:
`auth set-token`, `auth pat new`, `auth clear`, `cursos`, `tareas`, `planner`,
`calificaciones`, `anuncios`, `archivos`, `modulos`, `syllabus`, `paginas`,
`discusiones`, `quizzes`, `conferencias`, `calendario`, `inbox`.

Use case: `wiener intranet --help` da una vista filtrada limpia para discoverability;
`wiener canvas tareas` es equivalente exacto a `wiener tareas` (alias). El usuario
canónico tipea top-level plano siempre.

## Trust Ladder

| Level | Name | Friction | Commands |
|-------|------|----------|----------|
| T0 | auto | None | All read commands. `doctor`, `schema`, `config`, `auth status`, `auth logout`, `auth canvas clear`, `cursos aliases list/reset`, `archivos download` (≤50MB) |
| T2 | confirm | Show preview, require `--yes` (or interactive confirm in TTY) | `auth login`, `auth canvas set-token`, `auth canvas pat new` (opens browser), `cursos aliases` (wizard), `tramite generar` (creates billable obligation), `archivos download` (>50MB), `archivos sync` (bulk download) |
| T3 | killswitch | (none) | `wiener-cli` does not move money or destroy data |

Justification: skipping T3. Highest stakes write is `tramite generar` and that's
already T2 with explicit `--yes`. No "delete account" or "submit final grade"
surface exists.

## Safety Rails

- **Never store passwords on disk**. Intranet password lives in memory during
  `auth login` only. PAT is stored in OS keychain (macOS Keychain Access via
  `security` cmd; Linux fallback to file with `0600` perms + loud warning).
- **No retry on auth failure**. If `autenticate.asp` returns `estado: "0"` once,
  abort. Account lockout risk on intranet; PAT-side returns 401 cleanly.
- **No bulk write of `tramite generar`**. Even with `--yes`, refuse >1 per
  minute. Stops accidental fan-out.
- **Detect session expiry**. If intranet response contains `SiguNet.htm` or
  302 to `sso.asp`, clear session, surface `error.code = "auth-expired"`. Do
  NOT silently retry.
- **Detect PAT revocation**. If Canvas returns 401 with `WWW-Authenticate: Bearer`,
  clear stored PAT, surface `error.code = "canvas-token-invalid"` with hint
  to regenerate via `wiener auth canvas pat new`.
- **`watch` is opt-in only**. Never auto-starts at login. Single instance per
  user (lockfile in `~/.wiener/watch.pid`).
- **`archivos sync` shows total size BEFORE downloading** and requires `--yes`.
  Default cap: 500 MB per sync. Override with `--max-size N`.

## Agent-First Design

Required for every command:

- **`--json`** flag everywhere. Default human-formatted (color tables); `--json`
  emits one JSON object to stdout. Errors → `{ ok: false, error: { code, message, hint? } }` to stderr, exit 1.
- **`--ndjson`** for paginated/streaming results (especially `watch`, `tareas`, `archivos`).
- **`--dry-run`** for T2 mutations.
- **`--params '<json>'`** canonical input override; sugar flags + `--params` → `--params` wins.
- **`--fields a,b,c`** projection.
- **`--no-input`** forces non-interactive mode.
- **`--exact`** (course resolver) forces exact match.
- **`--yes`** skips T2 confirmations.
- **`wiener schema <command>`** publishes I/O JSON schema for runtime introspection.
- **Audit log** at `~/.wiener/audit.jsonl`, all T2 commands always; T0 only with `--verbose`.

### Canonical JSON envelope

```jsonc
// Success
{
  "ok": true,
  "data": { /* command-specific */ },
  "meta": {
    "duration_ms": 412,
    "rate_limit_remaining": 698.5,  // Canvas only
    "from_cache": false
  }
}

// Error
{
  "ok": false,
  "error": {
    "code": "course-ambiguous",
    "message": "Multiple courses match \"labo\"",
    "hint": "Try `wiener cursos` to see exact aliases",
    "details": {
      "candidates": [
        { "code": "FB6M4", "alias": "labo", "name": "LABORATORIO Y DIAGNÓSTICO II", "score": 0.98 },
        { "code": "FB6N3", "alias": "labquim", "name": "LABORATORIO DE QUÍMICA", "score": 0.74 }
      ]
    }
  }
}
```

### Error codes (canonical set)

| Code | When |
|---|---|
| `auth-required` | No session, command needs one |
| `auth-expired` | Intranet session timed out |
| `canvas-not-configured` | No PAT set, Canvas command attempted |
| `canvas-token-invalid` | PAT rejected (401) |
| `course-not-found` | Resolver returned 0 candidates |
| `course-ambiguous` | Resolver returned >1 with no clear winner |
| `network-error` | DNS/TCP/TLS issue |
| `rate-limited` | Canvas `rlr` < 50 + retry-after present |
| `parse-error` | HTML parser failed (intranet shape changed) |
| `validation-error` | Input failed schema |
| `not-implemented` | Command exists but feature deferred |

## `wiener nuevo` — diff state

State stored at `~/.wiener/state.json`:

```jsonc
{
  "last_run_at": "2026-04-26T18:42:13Z",
  "snapshots": {
    "anuncios": { "by_course": { "131067": { "last_id": "12345", "last_posted_at": "..." } } },
    "archivos": { "by_course": { "131067": { "last_modified_at": "..." } } },
    "calificaciones": { "by_assignment": { "964446": { "score": 17, "graded_at": "..." } } },
    "tareas": { "by_course": { "131067": { "ids": ["964446", ...] } } },
    "modulos": { "by_course": { "131067": { "items_count": 23 } } }
  }
}
```

Each `wiener nuevo` (or `wiener` solo) call:
1. Fetch current state of each surface (anuncios/archivos/calificaciones/tareas/modulos).
2. Diff against snapshot.
3. Emit deltas with type + curso + url.
4. Update snapshot.

`--dry-run` does diff without updating snapshot — useful for `watch` peek mode.

## `wiener watch` — background loop

Foreground TTY mode (default): runs in current terminal, NDJSON stream output.

Background mode (`--detach`): writes pid to `~/.wiener/watch.pid`, logs to
`~/.wiener/watch.log`, sends macOS notifications via `osascript -e 'display notification ...'`
when diff has items.

Single instance enforced by lockfile. `wiener watch stop` terminates.

Optional WhatsApp routing: `--whatsapp` posts to Hunter's Kapso conversation
(uses existing `~/.kai/webhook-secret` plumbing in his ecosystem) instead of
macOS notif. Disabled by default.

## Rabbit Holes

Things tempting but NOT v1:

- **Programmatic SAML2 login for Canvas**: cut. PAT is the path.
- **Submission upload** (`wiener tareas submit`): high-stakes, deferred. Read-only first.
- **Discussion posting** (`wiener discusiones reply`): same.
- **Matrícula portal automation** (`matricula.uwiener.edu.pe`): separate domain,
  high-stakes (locks schedule for semester), defer to v2.
- **Pagos:8443 banking integration**: real money, T3 territory. Out of scope.
- **Sofydoc trámite tracking**: separate domain, low frequency. Defer.
- **Multi-account / multi-student**: profiles supported in scaffold but only
  exercise default profile in v1.
- **Web UI / dashboard / TUI**: this is a CLI. JSON contract enables UIs to be
  built externally.
- **OCR of carné / boleta**: not the CLI's job.
- **MCP server wrapping the CLI**: deferred until shape stabilizes (~v0.7+).
- **Notifications fan-out (Slack, Telegram)**: only macOS notif + optional
  WhatsApp. Others composable externally with `--ndjson | jq | curl`.
- **Cron scheduling**: out of scope. Compose with `cron + wiener nuevo --json | jq`.

## No-Gos

Hard boundaries, never:

- **Will not store Wiener passwords on disk**. Intranet password lives in memory
  for one request, dropped immediately.
- **Will not auto-execute `tramite generar`** without explicit `--yes` or
  interactive confirm. Even agents must pass `--yes` after preview.
- **Will not pay anything**. Generates orders, never pays.
- **Will not modify grades, attendance, submissions, or any academic record**.
  Read-only on academic data. Defense-in-depth, even though portal doesn't allow it.
- **Will not bypass MS Entra MFA** or attempt SAML automation. Manual PAT
  generation is the only Canvas auth path.
- **Will not scrape other students' data**. Only authenticated user's records.
- **Will not disable TLS verification**.
- **Will not upload submissions in v1**. Even if API supports it.
- **`watch` will not run by default** — explicit opt-in always.

## Open Questions (resolve during implementation)

1. **CSRF token rotation**: scrape every session anyway. Probe weekly via
   `wiener doctor` and surface drift in `--debug`.
2. **PAT generation lockdown timing**: Wiener could disable `users#manageable_access_tokens`
   any time. `wiener doctor` includes a "can-create-pat" check that hits
   `/profile/settings` HTML and looks for the link.
3. **Notas page period switching**: GET param? Form POST? Verify on day 2.
4. **`tramite generar` exact endpoint**: not exercised in recon. Verify on day 4.
5. **Conversaciones SQS-style**: Canvas inbox uses long-polling for
   real-time. v1 just polls on `wiener inbox`; `wiener watch --inbox` for
   notif-on-new-message would need separate polling logic.
6. **Module item types**: Canvas modules have `Page`/`Assignment`/`File`/`ExternalUrl`/etc.
   `wiener modulos` should resolve each type to an actionable URL — verify
   the type set used by Wiener courses on day 3.
7. **Quizzes API surface**: Classic Quizzes vs New Quizzes use different
   endpoints. Detect which Wiener uses.
8. **`tareas` cross-course performance**: 11 active courses × `/assignments`
   call = 11 requests for `wiener tareas`. Implement parallel-fetch with
   concurrency=4 and cache 5 min. Probably fine but measure.

## Implementation Order

Day-by-day plan in §Appetite. v0.1.0 ships at end of day 2 (intranet only),
v0.4.0 at day 4 (Canvas reads), v0.6.0 at day 6 (nuevo + watch), v0.7.0 at day
7 after smoke pass. Tag each in git, no npm publish until v0.7.0 stabilizes.

After v0.7.0, optional v1.0:
- MCP server wrapping the CLI (1 day).
- WhatsApp routing for `wiener watch` (0.5 day).
- Bulk export of all course materials (`wiener archivos sync --all`, 0.5 day).
