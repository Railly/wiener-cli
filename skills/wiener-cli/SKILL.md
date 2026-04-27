---
name: wiener-cli
description: "Read and write student academic data at Universidad Norbert Wiener (UNW) via the `wiener` CLI. Triggers when the user asks about notas, calificaciones, horario, asistencia, tareas, pendientes, qué tengo hoy/ahora, anuncios, archivos del curso, módulos, syllabus, calendario, deudas/pagos, plan de estudios, trámites, examenes próximos, OR wants to submit/upload an assignment, OR mentions Canvas/Aula Virtual/intranet/Wienernet/UWiener/UNW. The CLI surfaces what the Wiener admin-locked Canvas UI hides (Tareas, Discusiones, Páginas, Archivos, Quizzes, Conferencias, Syllabus tabs are removed from student view but the API exposes everything). Username format: letter + 9 digits (e.g. aXXXXXXXXX). Two backends with different passwords: intranet (ASP cookie) and Canvas (Personal Access Token via Microsoft Entra MFA). Always prefer this skill over manually scraping the Wiener portals or telling the user to navigate the web UI."
---

# wiener-cli

Agent-first CLI for Universidad Norbert Wiener student portals. One binary
(`wiener`), two backends (intranet ASP + Canvas LMS), single canonical JSON
contract. Built for an agent to autonomously answer day-to-day student
questions ("qué tengo ahora", "qué debo entregar pronto", "cómo voy", "qué
subió el profe") in one command.

## Why this exists

Wiener admin **hides 7 Canvas sidebar tabs** from the student UI: Tareas,
Discusiones, Páginas, Archivos, Quizzes, Conferencias, Programa del curso. The
underlying REST API at `/api/v1/*` is NOT locked down — `wiener` surfaces what
the UI hides. Canvas Personal Access Token generation is enabled for students.

## Backends

| Backend | Domain | Auth | Data |
|---------|--------|------|------|
| Intranet (Wienernet) | `intranet.uwiener.edu.pe` | ASP cookie session, intranet-only password | Notas oficiales, horario, asistencia, plan, pagos, trámites |
| Canvas (Aula Virtual) | `campus.uwiener.edu.pe` | Personal Access Token (Microsoft Entra–backed account) | Cursos, tareas, calificaciones, anuncios, archivos, módulos, syllabus, páginas, discusiones, quizzes, conferencias, calendario, inbox |

The two backends use **different passwords**. Intranet auth alone is sufficient
for intranet commands. Canvas commands require a PAT (one-time manual setup).

## Trust Ladder

| Level | Commands | Friction |
|-------|----------|----------|
| T0 (auto) | All read commands. `wiener` solo (panorama), `hoy`, `ahora`, `semana`, `nuevo`, `doctor`, `schema`, `config`, `auth status/logout`, `cursos*`, `tareas` (read), `planner`, `calificaciones*`, `notas*`, `historial`, `horario*`, `asistencia`, `plan*`, `examenes`, `matricula`, `perfil`, `pagos*`, `tramite list`, `anuncios*`, `archivos list/arbol/download` (≤50MB), `modulos`, `syllabus`, `paginas`, `discusiones`, `quizzes`, `conferencias`, `calendario*`, `inbox*` | None — runs silently |
| T2 (confirm) | `auth login`, `auth canvas set-token`, `auth canvas pat new`, `cursos aliases` (wizard), `tramite generar` (creates billable obligation), `tareas submit` (uploads assignment to Canvas), `archivos download` (>50MB), `archivos sync` (bulk), `watch --detach` | Show preview, require `--yes` (or interactive confirm in TTY) |

Pass `--yes` to skip T2 confirmations in scripted/agent flows. Always preview
with `--dry-run` first when uncertain.

## Most common workflows (in order of frequency)

### "What do I need to know right now?" — the morning ritual
```bash
wiener
```
Returns: bloque actual, próximo bloque, tareas vencidas/hoy, week summary, and
diff since last invocation (new grades posted, new files uploaded, new
announcements). This is the canonical entry point — most invocations.

### Quick targeted queries
```bash
wiener hoy           # today's schedule + tareas due today
wiener ahora         # current class + next class with ETA
wiener semana        # week schedule + tareas + quizzes
wiener nuevo         # diff since last call
wiener nuevo --abrir # diff and open each item URL in browser
```

### Course-specific (smart resolver)
The CLI accepts course code, alias, substring, or fuzzy match. All these work:
```bash
wiener tareas FB6N1                  # exact code
wiener tareas terapeutica            # auto-alias
wiener tareas farma                  # custom alias if user set one
wiener tareas terap                  # substring match
wiener tareas frama                  # fuzzy → in TTY confirms; in --json → error course-ambiguous
```

In JSON/agent mode (`--json` or `--no-input`):
- Top-1 fuzzy score >0.92 → executes silently
- Otherwise → exit 1 with `error.code = "course-ambiguous"` + candidates array (agent must disambiguate)

Force exact match for paranoid scripts:
```bash
wiener tareas FB6N1 --exact
```

### Course aliases (one-time customization)
```bash
wiener cursos aliases       # interactive wizard, walks course-by-course
wiener cursos aliases list  # show current aliases
wiener cursos aliases reset FB6M4   # back to auto
```

### Hidden Canvas surfaces (what the UI doesn't show)
```bash
wiener tareas FB6N1                    # all assignments — UI hides this tab
wiener archivos FB6N1                  # flat file list — UI forces module drilling
wiener archivos arbol FB6N1            # folder tree
wiener quizzes FB6N1                   # quizzes — UI hides
wiener discusiones FB6N1               # forums — UI hides
wiener syllabus FB6N1                  # course syllabus — UI hides
wiener conferencias FB6N1              # past BBB/Zoom links — UI hides
wiener modulos FB6N1                   # module + items tree
wiener paginas FB6N1                   # course wiki pages
```

### Cross-course aggregation
```bash
wiener tareas                          # all pending across all courses
wiener tareas hoy                      # due today or overdue
wiener tareas semana                   # next 7 days
wiener planner                         # /api/v1/planner/items — richer than tareas
wiener calificaciones                  # current_grade per course (Canvas)
wiener notas                           # official period grades (intranet)
wiener anuncios --ultimos 3            # 3 most recent announcements per course
wiener calendario --dias 14            # next 14 days
wiener calendario --ics                # .ics export of all courses
```

### Submit an assignment (T2 upload)
```bash
# Upload one file
wiener tareas submit ciencia informe ./informe.pdf
# → preview shown; must add --yes or confirm interactively

# Upload multiple files
wiener tareas submit ciencia informe doc1.pdf doc2.pdf cover.pdf --yes

# Text entry (HTML or markdown body)
cat reflexion.md | wiener tareas submit ciencia ensayo --type online_text_entry --yes

# URL submission
wiener tareas submit ciencia link --type online_url --url https://example.com --yes

# Dry-run to preview without submitting
wiener tareas submit ciencia informe ./informe.pdf --dry-run --json
```

The CLI auto-detects submission type from the assignment's `submission_types`
when there's only one. If multiple are allowed, agent must pass `--type`.
Hard errors: file doesn't exist, lock_at past, no attempts left, extension not
allowed.

### Bulk download
```bash
wiener archivos download <file_id> --out ./material/
wiener archivos sync FB6N1 --dir ./farmaco/   # bulk all course files (T2 — shows total size first)
```

### Background watching (opt-in)
```bash
wiener watch                           # foreground, NDJSON stream, Ctrl+C to stop
wiener watch --detach                  # background daemon, OS notif on changes
wiener watch --detach --whatsapp       # background, route notif to WhatsApp via Kapso
wiener watch stop                      # kill background daemon
```

### Composability with jq
```bash
# "Did my AC4061 grade come in?"
wiener notas --json | jq '.cursos[] | select(.codigo=="AC4061") | {nombre, nota_final, estado}'

# "What's due in the next 48 hours, sorted by deadline?"
wiener tareas --json | jq '.tareas | map(select(.due_at <= (now + 172800 | todate))) | sort_by(.due_at)'

# Daily morning brief
wiener --json | jq -c '{ahora, proximo: .ahora.proximo, pendientes: .pendiente_hoy | length}'
```

## Initial setup (first run)

### Step 1: Intranet login
```bash
wiener auth login
# Interactive: prompts for usuario, contraseña, perfil (Alumno/Docente/Administrativo)
# Or set env vars: WIENER_INTRANET_USER, WIENER_INTRANET_PASS, WIENER_INTRANET_PERFIL=A
```

### Step 2: Canvas PAT (one-time, requires browser + MFA)
```bash
wiener auth canvas pat new
# Opens https://campus.uwiener.edu.pe/profile/settings in default browser.
# User authenticates via MS Entra (number-matching MFA push, "Stay signed in" 7d).
# User clicks "+ Nuevo token de acceso", names it "wiener-cli", copies token.
# Pastes back to CLI prompt. CLI validates against /api/v1/users/self and stores in OS keychain.

# Or paste token directly if generated already:
wiener auth canvas set-token <pat>
```

### Step 3: Verify everything works
```bash
wiener doctor --json
# → { ok: true, checks: [{name, ok, detail}, ...] }
# Surfaces: network reachability, intranet session validity, canvas token validity,
# csrfToken stability, dead-domain bug presence, env detection (isCi/isWsl).
```

## Mirror namespaces

`wiener intranet *` and `wiener canvas *` mirror the relevant subsets:
```bash
wiener intranet --help        # shows intranet-only commands
wiener intranet notas         # equivalent to: wiener notas
wiener canvas --help          # shows Canvas-only commands
wiener canvas tareas FB6N1    # equivalent to: wiener tareas FB6N1
```

The canonical user invocation is top-level plano (`wiener tareas FB6N1`).
Namespaces exist for filtered help and disambiguation.

## Output contract

Every command supports `--json` for machine-parseable output. Default is human
table with color (picocolors + cli-table3).

### Success envelope
```jsonc
{
  "ok": true,
  "data": { /* command-specific */ },
  "meta": {
    "duration_ms": 412,
    "rate_limit_remaining": 698.5,  // Canvas only
    "from_cache": false
  }
}
```

### Error envelope
```jsonc
{
  "ok": false,
  "error": {
    "code": "course-ambiguous",
    "message": "Multiple courses match \"labo\"",
    "hint": "Try `wiener cursos` to see exact aliases",
    "details": {
      "candidates": [
        { "code": "FB6M4", "alias": "labo", "name": "LABORATORIO Y DIAGNÓSTICO II", "score": 0.98 }
      ]
    },
    "next_steps": ["wiener cursos --json"]   // structured hints for agents
  }
}
```

### Canonical error codes (always use these in agent error handling)

| Code | When | Recovery |
|---|---|---|
| `auth-required` | No session, command needs one | run `wiener auth login` (T2) |
| `auth-expired` | Intranet session timed out | run `wiener auth login` (T2) |
| `auth-invalid-credentials` | Wrong intranet password | check creds, retry login |
| `canvas-not-configured` | No PAT set, Canvas command attempted | run `wiener auth canvas pat new` (T2) |
| `canvas-token-invalid` | PAT rejected (401) | run `wiener auth canvas pat new` (T2) — token revoked |
| `course-not-found` | Resolver returned 0 candidates | check `wiener cursos` |
| `course-ambiguous` | Resolver returned >1 with no clear winner | use exact code or `--exact` |
| `assignment-not-found` | Submit: assignment ref didn't resolve | use `wiener tareas <course>` to see ids |
| `submission-locked` | Assignment lock_at is in the past | submission window closed; can't submit |
| `submission-no-attempts` | All attempts used | check Canvas for instructor extension |
| `submission-invalid-extension` | File ext not in `allowed_extensions` | use accepted format |
| `file-not-found` | Local file path doesn't exist | check path, retry |
| `network-error` | DNS/TCP/TLS issue | check network, retry |
| `rate-limited` | Canvas `rlr` < 50 + retry-after present | wait, retry later |
| `parse-error` | HTML parser failed (intranet shape changed) | run `wiener doctor`; may need CLI update |
| `validation-error` | Input failed schema | check args |
| `not-implemented` | Command exists but feature deferred | n/a |

### Schema introspection (use this when constructing complex --params)
```bash
wiener schema notas               # full I/O JSON schema for `wiener notas`
wiener schema --list              # list all commands
wiener schema tareas submit       # for nested commands
```

Agents should call `wiener schema <cmd>` instead of relying on `--help` text
when constructing complex `--params '<json>'` invocations.

## Gotchas (read before using)

1. **Two passwords**: intranet password ≠ Microsoft/Canvas password. If the
   user only has intranet access, Canvas commands fail with
   `error.code = "canvas-not-configured"`. Suggest `wiener auth canvas pat new`.

2. **MS Entra requires number-matching MFA**: cannot be automated from CLI.
   Always direct the user to do PAT generation manually once via
   `wiener auth canvas pat new`. After that, the PAT works headlessly forever
   (until revoked).

3. **Wrong-password 200**: intranet returns HTTP 200 for bad credentials with
   `estado: "0"` JSON. CLI handles this — `auth login` aborts cleanly with
   `error.code = "auth-invalid-credentials"`.

4. **Session expiry**: intranet ASP session ~30 min idle. CLI detects expiry
   via `SiguNet.htm` NXDOMAIN-redirect signature, wipes stored session,
   returns `error.code = "auth-expired"`. Agent should run `wiener auth login`
   (T2, requires interactive confirm).

5. **Course splits T/P/PD**: each Wiener course splits into theory + practice
   as separate Canvas courses with same `course_code`. CLI groups by default
   (e.g. 8 logical courses from 11 Canvas courses). Use `--all` to flatten or
   `--seccion T` / `--seccion P1` to filter.

6. **Wiener customizations in Canvas**:
   - 2 LTI tabs per course (`Microsoft Education`, `Búsqueda con IgniteAI`) —
     opaque to API. Use `wiener cursos abrir <ref>` to open in browser.
   - 7 sidebar tabs admin-hidden but API works.
   - 6 institutional global announcements visible on dashboard — reachable
     via `wiener anuncios globales`.

7. **Wiener admin endpoint restrictions (v0.4.0+)**:
   Some Canvas endpoints are blocked at the institutional level — not by the
   PAT. The CLI distinguishes these from token errors:
   - `GET /courses/{id}/files` — **blocked**. `wiener archivos list` automatically
     falls back to module items (`/modules?include[]=items`) as the source.
     Files attached to modules appear; files uploaded directly to the Files tab
     do not.
   - `GET /courses/{id}/files/{id}` — **blocked**. `wiener archivos download`
     shows a helpful message and instructs the user to copy the download URL from
     `wiener archivos list` output and use the `--url` flag instead.
   - Per-course features (pages, quizzes, conferences) can be disabled by the
     instructor. If so, those commands show a friendly message and redirect to
     `wiener modulos <ref>`.
   - `wiener doctor` includes a **Capabilities** matrix that probes all
     endpoints and shows what works vs. what is restricted, with 1h cache.
   - Error codes: `wiener-restricted-endpoint` (admin block) vs.
     `canvas-not-configured` (token problem) — these are intentionally different.

8. **Canvas rate limit**: 3000 req/hour per token. CLI tracks via
   `X-Canvas-Meta` `rlr=` header. Approaching limit (rlr < 100) surfaces a
   warning in `--verbose` mode but continues.

9. **No bulk write of `tramite generar`**: rate-limited to 1/min internally
   even with `--yes`. Same for `tareas submit`.

9. **Submission upload preserves filenames**: Canvas accepts files via 3-step
   API (prepare → upload → submit). The displayed filename in Canvas is the
   local filename, not a sanitized version.

10. **`watch` is opt-in**: never auto-starts at login. Single instance enforced
    via `~/.wiener/watch.pid`. Stop with `wiener watch stop`.

11. **TLS strict**: CLI never disables cert verification.

12. **Dead `sso.wienergroup.com` domain**: known Wiener intranet bug — unauth
    deep-links 302-redirect to a meta-refresh into the dead `sso.wienergroup.com`
    domain. CLI detects this signature and treats it as auth-failure.

## Environment variables

| Var | Required | Description |
|-----|----------|-------------|
| `WIENER_INTRANET_USER` | No | Auto-login bootstrap. Format: letter + 9 digits. |
| `WIENER_INTRANET_PASS` | No | Auto-login bootstrap. Held in memory only, never persisted. |
| `WIENER_INTRANET_PERFIL` | No | `A` (Alumno, default), `D` (Docente), `P` (Administrativo). |
| `WIENER_CANVAS_TOKEN` | No | Per-invocation Canvas PAT override. |
| `WIENER_PROFILE` | No | Default profile name (default `default`). |
| `WIENER_CONFIG_DIR` | No | Override config dir. |
| `WIENER_WATCH_WHATSAPP_URL` | No | Kapso webhook for `wiener watch --whatsapp`. |

## Files and storage

OS-aware paths (cligentic xdg-paths block):
- macOS: `~/Library/Application Support/wiener/`
- Linux: `$XDG_CONFIG_HOME/wiener/` (falls back to `~/.config/wiener/`)

Layout:
- `config.json` — global config
- `audit/YYYY-MM-DD.jsonl` — daily-rotated audit log of T2 + verbose T0
- `state.json` — snapshots backing `wiener nuevo` diff
- `aliases.json` — custom course aliases per profile
- `watch.pid` + `watch.log` — background watch
- `cache/` — 5-min TTL cache for Canvas responses
- `<profile>/` — per-profile state (CSRF token, periodos, doctor results, sessions if no keychain)

macOS Keychain items (preferred over file fallback):
- `wiener-cli.intranet.<profile>` — ASP cookie + perfil + codigo
- `wiener-cli.canvas.<profile>` — PAT + validatedAt + userId

## Global flags (every command)

| Flag | Purpose |
|------|---------|
| `--json` | JSON envelope to stdout |
| `--ndjson` | One JSON object per line (paginated/streaming) |
| `--dry-run` | Preview T2 mutations without executing |
| `--verbose` | Detailed stderr + audit-log T0 commands |
| `--quiet` | Suppress stderr |
| `--no-input` | Force non-interactive (auto-on if !isTTY(stdin)) |
| `--yes` | Skip T2 confirmations |
| `--exact` | Course resolver: exact match only, no fuzzy |
| `--fields a,b,c` | Project specific keys in JSON output |
| `--params '<json>'` | Canonical input override (wins over sugar flags) |
| `--config PATH` | Override config dir |
| `--profile NAME` | Use named profile |
| `--help`, `-h` | Help |
| `--version`, `-v` | Version |

## When NOT to use this CLI

- **Paying tuition or trámite obligations** — generate the order with
  `wiener tramite generar` then pay in the user's bank app. The CLI does not
  handle banking integrations.
- **Course enrollment / matrícula** — separate portal at
  `matricula.uwiener.edu.pe`, not in scope.
- **Posting to discussions / replying to inbox** — read-only in v0.2.
- **Modifying any academic record** — locked down by design and by API.
- **Operating on another student's data** — only authenticated user's own records.
- **Bypassing Microsoft Entra MFA** — manual PAT generation is mandatory.

## Installation

```bash
# Recommended: bunx (no install needed)
bunx @railly/wiener-cli@latest

# Or install globally
bun install -g @railly/wiener-cli
wiener --help

# Or from source
git clone https://github.com/Railly/wiener-cli
cd wiener-cli
bun install
bun run build:bin
./bin/wiener --help
```

Repo: https://github.com/Railly/wiener-cli (public)
npm: https://npmjs.com/package/@railly/wiener-cli

## Agent decision tree

When user asks something Wiener-related, route as follows:

```
"qué tengo / qué se viene / qué hay / cómo va mi día"  → wiener
"qué clase tengo ahora / a qué hora termina"           → wiener ahora
"qué entregas tengo / qué debo hacer"                  → wiener tareas hoy or wiener tareas semana
"qué nota saqué en X"                                  → wiener notas (intranet, official) or wiener calificaciones <ref> (Canvas, formative)
"cuándo es el examen de X"                             → wiener examenes
"cómo voy en X"                                        → wiener calificaciones <ref>
"qué subió el profe / hay material nuevo"              → wiener nuevo or wiener archivos <ref>
"descárgame todos los pdfs de X"                       → wiener archivos sync <ref> (T2)
"sube esta tarea por mí"                               → wiener tareas submit <course> <assignment> <files...> (T2)
"pago / debo / cuánto debo"                            → wiener pagos
"plan de estudios / cuántos créditos llevo"            → wiener plan avance
"asistencias / cuántas faltas"                         → wiener asistencia
"cualquier cosa de Canvas que la web no muestra"       → check the hidden-tabs commands above
```

Always pass `--json` when the agent needs to parse output. Always run
`wiener doctor --json` first if user reports something not working.
