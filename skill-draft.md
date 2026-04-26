---
description: "Read student academic data from Universidad Norbert Wiener (intranet 'Wienernet' + Canvas LMS 'Aula Virtual'). Use when the user asks about notas, horario, asistencia, tareas, pendientes, calificaciones, anuncios, archivos del curso, calendario, deudas, plan de estudios, qué tengo hoy/ahora, o cualquier dato del portal del alumno UNW. Username format is letter + 9 digits (e.g. aXXXXXXXXX). Wiener admin hides 7 Canvas tabs (Tareas, Discusiones, Páginas, Archivos, Quizzes, Conferencias, Syllabus) from the student UI but the API exposes everything — this CLI surfaces what the UI hides."
---

# wiener-cli

Agent-first CLI for Universidad Norbert Wiener (UNW) student portals. One
binary, two backends, single canonical JSON contract. Built for an agent to
autonomously answer day-to-day student questions ("qué tengo ahora", "qué
debo entregar pronto", "cómo voy", "qué subió el profe") in one command.

## Backends

| Backend | Domain | Auth | Data |
|---------|--------|------|------|
| Intranet (Wienernet) | `intranet.uwiener.edu.pe` | ASP cookie session, intranet-only password | Notas oficiales, horario, asistencia, plan de estudios, pagos, trámites |
| Canvas (Aula Virtual) | `campus.uwiener.edu.pe` | **Personal Access Token** (recommended path) | Cursos, tareas, calificaciones formativas, anuncios, archivos, módulos, syllabus, páginas, discusiones, quizzes, conferencias, calendario, inbox |

**Critical**: the two backends use different passwords. Intranet auth alone is
sufficient for intranet commands. Canvas commands require the user to have
manually generated a PAT once — guide them via `wiener auth canvas pat new`.

**The Wiener gotcha**: Wiener admin hides 7 tabs from the Canvas student
sidebar (Tareas, Discusiones, Páginas, Archivos, Quizzes, Conferencias,
Programa del curso). The corresponding REST API endpoints are NOT locked down.
The CLI gives the student access to data the UI hides — this is the primary
value-add over just opening the browser.

## Trust Ladder

| Level | Commands | Friction |
|-------|----------|----------|
| T0 (auto) | All read commands. `wiener` solo (panorama), `hoy`, `ahora`, `semana`, `nuevo`, `doctor`, `schema`, `config`, `auth status/logout`, `cursos*`, `tareas*`, `planner`, `calificaciones*`, `notas*`, `historial`, `horario*`, `asistencia`, `plan*`, `examenes`, `matricula`, `perfil`, `pagos*`, `tramite list`, `anuncios*`, `archivos list/arbol/download` (≤50MB), `modulos`, `syllabus`, `paginas`, `discusiones`, `quizzes`, `conferencias`, `calendario*`, `inbox*` | None — runs silently |
| T2 (confirm) | `auth login`, `auth canvas set-token`, `auth canvas pat new`, `cursos aliases` (wizard), `tramite generar` (creates billable obligation), `archivos download` (>50MB), `archivos sync` (bulk download), `watch --detach` | Show preview, require `--yes` (or interactive confirm in TTY) |

`tramite generar` is T2 because it creates a real billable obligation in
Wiener's billing system. Always preview the monto + concepto before confirming.

## Common Workflows

### Morning routine — "what do I need to know right now?"
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
wiener nuevo         # diff since last call (anuncios, archivos, calificaciones, tareas, modulos)
```

### Course-specific (with smart resolver)
```bash
# All these resolve to the same course (FB6N1 — TERAPÉUTICA FARMACOLÓGICA III):
wiener tareas FB6N1
wiener tareas terapeutica          # auto-alias
wiener tareas farma                # custom alias if user set one
wiener tareas terap                # substring match
wiener tareas frama                # fuzzy: prompts "¿Quisiste decir farma?"

# Force exact match (no fuzzy):
wiener tareas FB6N1 --exact
```

The resolver order: exact → substring → fuzzy → no-match (top 5 candidates).
In `--json`/`--no-input` mode, ambiguous resolution returns
`error.code = "course-ambiguous"` with candidates array — the agent must
disambiguate.

### Course aliases setup (one-time, optional)
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
wiener quizzes FB6N1                   # quiz list with due dates — UI hides
wiener discusiones FB6N1               # forums — UI hides
wiener syllabus FB6N1                  # course syllabus — UI hides
wiener conferencias FB6N1              # past BBB/Zoom links — UI hides
wiener modulos FB6N1                   # module + items tree
```

### Cross-course aggregation
```bash
wiener tareas                          # all pending across all 8 courses
wiener tareas hoy                      # due today or overdue
wiener tareas semana                   # next 7 days
wiener planner                         # /api/v1/planner/items — richer than `tareas`, includes ignored/late/missing flags
wiener calificaciones                  # current_grade per course (Canvas)
wiener notas                           # official period grades (intranet)
wiener anuncios --ultimos 3            # 3 most recent announcements per course
wiener calendario --dias 14            # next 14 days events (assignments + calendar items)
wiener calendario --ics                # .ics export of all courses
```

### Bulk download
```bash
wiener archivos download <file_id> --out ./material/
wiener archivos sync FB6N1 --dir ./farmaco/   # bulk all course files (T2 — shows total size first)
```

### Background watching
```bash
wiener watch                           # foreground, NDJSON stream, Ctrl+C to stop
wiener watch --detach                  # background daemon, macOS notif on changes
wiener watch --detach --whatsapp       # background, route notif to WhatsApp via Kapso
wiener watch stop                      # kill background daemon
```

### Setup Canvas access (one-time, manual MFA)
```bash
wiener auth canvas pat new
# → Opens https://campus.uwiener.edu.pe/profile/settings in default browser.
# → User authenticates via MS Entra (number-matching MFA push, "Stay signed in" 7d).
# → User clicks "+ Nuevo token de acceso", names it "wiener-cli", copies token.
# → Pastes back to CLI prompt. CLI validates against /api/v1/users/self and stores in OS keychain.

# Or paste token directly if generated already:
wiener auth canvas set-token <pat>
```

### Diagnostic before any agent operation
```bash
wiener doctor --json
# → { ok: true, checks: [
#     { name: "intranet-reachable", ok: true },
#     { name: "intranet-session", ok: true, age_minutes: 14 },
#     { name: "canvas-reachable", ok: true },
#     { name: "canvas-pat-valid", ok: true, user_id: "64504" },
#     { name: "csrf-token-stable", ok: true, value: "9144AF7" },
#     { name: "pat-generation-enabled", ok: true },
#     { name: "rate-limit-headroom", ok: true, rlr: 698.5 }
#   ]}
```

### Composability with jq pipelines
```bash
# "Did my AC4061 grade come in?"
wiener notas --json | jq '.cursos[] | select(.codigo=="AC4061") | {nombre, nota_final, estado}'

# "What's due in the next 48 hours, sorted by deadline?"
wiener tareas --json | jq '.tareas | map(select(.due_at <= (now + 172800 | todate))) | sort_by(.due_at)'

# "Cuál es el archivo más nuevo del curso farma?"
wiener archivos farma --json | jq '.archivos | sort_by(.modified_at) | reverse | .[0]'

# Daily morning brief (composable script)
wiener --json | jq -c '{ahora, proximo: .ahora.proximo, pendientes: .pendiente_hoy | length}'
```

## Gotchas

1. **Two passwords**: intranet password ≠ Microsoft/Canvas password. If the
   user only has intranet access, Canvas commands fail with
   `error.code = "canvas-not-configured"`. Suggest `wiener auth canvas pat new`.

2. **MS Entra requires number-matching MFA**: cannot be automated from CLI.
   Always direct the user to do PAT generation manually once.

3. **Wrong-password 200**: intranet returns HTTP 200 for bad credentials with
   `estado: "0"` in JSON. CLI handles this — `auth login` aborts cleanly with
   `error.code = "auth-invalid-credentials"`.

4. **Session expiry**: intranet ASP session ~30 min idle. CLI detects expiry
   via `SiguNet.htm` NXDOMAIN-redirect signature, wipes stored session,
   returns `error.code = "auth-expired"`. Agent should run `wiener auth login`
   to re-auth (T2, requires interactive confirm).

5. **PAT revocation**: if Canvas returns 401, CLI clears stored PAT and returns
   `error.code = "canvas-token-invalid"` with hint pointing to
   `wiener auth canvas pat new`.

6. **`csrfToken=9144AF7` is hard-coded constant**. CLI re-scrapes from
   `sso.asp` every login. If `wiener doctor` reports `csrf-token: drifted`,
   the CLI adapted automatically; informational only.

7. **Wiener customizations in Canvas**:
   - 2 LTI tabs per course (`Microsoft Education`, `Búsqueda con IgniteAI`) —
     opaque to API. Use `wiener cursos abrir <ref>` to open in browser.
   - 7 sidebar tabs admin-hidden but API works.
   - 6 institutional global announcements visible on dashboard — reachable
     via `wiener anuncios globales`.

8. **Course splits T/P/PD**: each Wiener course splits into theory + practice
   as separate Canvas courses with same `course_code`. CLI groups by default
   (8 logical from 11 Canvas courses). Use `--all` to flatten or
   `--seccion T`/`--seccion P1` to filter.

9. **Canvas rate limit**: 3000 req/hour per token. CLI tracks
   `X-Canvas-Meta` `rlr=` header. Approaching limit (rlr < 100) surfaces a
   warning in `--verbose` mode but continues.

10. **Pagination**: Canvas commands listing N items follow `Link rel=next`
    automatically. For very large lists, prefer `--ndjson` to stream.

11. **No bulk write of `tramite generar`**: rate-limited to 1/min internally
    even with `--yes`.

12. **Account scope**: each `wiener` session is bound to one `--profile`
    (default `default`). Multi-account future-proofed but only `default`
    exercised in v1.

13. **TLS strict**: CLI never disables cert verification.

14. **Dead `sso.wienergroup.com` domain**: known Wiener intranet bug —
    unauth deep-links 302-redirect to a meta-refresh into the dead
    `sso.wienergroup.com` domain. CLI detects this signature and treats it
    as auth-failure.

15. **`watch` is opt-in**: never auto-starts. Single instance enforced via
    `~/.wiener/watch.pid`.

## Environment

| Var | Required | Description |
|-----|----------|-------------|
| `WIENER_INTRANET_USER` | No | Auto-login bootstrap. Format: letter + 9 digits. |
| `WIENER_INTRANET_PASS` | No | Auto-login bootstrap. Held in memory only. |
| `WIENER_INTRANET_PERFIL` | No | `A` (Alumno, default), `D` (Docente), `P` (Administrativo). |
| `WIENER_CANVAS_TOKEN` | No | Per-invocation Canvas PAT override. |
| `WIENER_PROFILE` | No | Default profile name. |
| `WIENER_CONFIG_DIR` | No | Override `~/.wiener`. |

## Files

- `~/.wiener/config.json` — global config (resolver thresholds, watch interval, panorama options)
- `~/.wiener/audit.jsonl` — append-only audit log of T2 + verbose T0
- `~/.wiener/state.json` — snapshots backing `wiener nuevo` diff
- `~/.wiener/aliases.json` — custom course aliases per profile
- `~/.wiener/watch.pid` + `watch.log` — background watch
- `~/.wiener/cache/` — 5-min TTL cache for Canvas responses
- `~/.wiener/<profile>/` — per-profile state (CSRF token, periodos, doctor results)
- macOS Keychain items: `wiener-cli.intranet.<profile>`, `wiener-cli.canvas.<profile>`

## Schema introspection

Every command publishes its JSON I/O schema for runtime discovery:

```bash
wiener schema notas
# → { command: "notas", args: {...}, output_schema: {...} }
wiener schema --list
# → { commands: [...] }
```

Agents should call `wiener schema <cmd>` instead of relying on `--help` text
when constructing complex `--params '<json>'` invocations.

## Mirror namespaces (alternative entry)

For discoverability and disambiguation, `wiener intranet *` and
`wiener canvas *` mirror the relevant subsets:

```bash
wiener intranet --help        # shows intranet-only commands
wiener intranet notas         # equivalent to: wiener notas
wiener canvas --help          # shows Canvas-only commands
wiener canvas tareas FB6N1    # equivalent to: wiener tareas FB6N1
```

The canonical user invocation is top-level plano (`wiener tareas FB6N1`).
Namespaces exist as alias entry, useful when an agent wants filtered help.

## When NOT to use this CLI

- **Paying tuition or trámite obligations** — generate the order with
  `wiener tramite generar` then pay in the user's bank app.
- **Course enrollment / matrícula** — separate portal at
  `matricula.uwiener.edu.pe`, not in scope.
- **Submitting assignments** — read-only on submissions in v1.
- **Posting to discussions / replying to inbox** — read-only in v1.
- **Modifying any academic record** — locked down by design and by API.
- **Operating on another student's data** — only authenticated user's records.
- **Bypassing Microsoft Entra MFA** — manual PAT generation is mandatory.
