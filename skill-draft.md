---
description: "Read student academic data from Universidad Norbert Wiener (intranet 'Wienernet' + Canvas 'Campus'). Use when the user asks about notas, horario, asistencia, tareas, pendientes, calendario, deudas, plan de estudios, o cualquier dato del portal del alumno UNW. Username format is letter + 9 digits (e.g. aXXXXXXXXX)."
---

# wiener-cli

Agent-first CLI for Universidad Norbert Wiener (UNW) student portals. Wraps two
separate backends (intranet ASP + Canvas LMS) behind one consistent JSON
contract. Built for an agent to autonomously answer "qué nota saqué", "qué
clase tengo ahora", "qué tareas debo entregar" without manual portal
navigation.

## Backends

| Backend | Domain | Auth | Data |
|---------|--------|------|------|
| Intranet | `intranet.uwiener.edu.pe` | ASP cookie session, intranet-only password | Notas, horario, asistencia, plan, pagos, trámites |
| Canvas | `campus.uwiener.edu.pe` | Personal access token (Microsoft Entra–backed account) | Cursos, tareas, anuncios, archivos, calendario, inbox |

The two backends use **different passwords**. Intranet auth alone is sufficient
for v1 commands. Canvas commands require the user to have manually generated
and registered an access token via `wiener auth canvas set-token`.

## Trust Ladder

| Level | Commands | Friction |
|-------|----------|----------|
| T0 (auto) | `notas`, `historial`, `horario`, `asistencia`, `plan`, `examenes`, `matricula`, `perfil`, `pagos pendientes`, `pagos historial`, `tramite list`, `cursos`, `cursos info`, `tareas`, `tareas hoy`, `tareas semana`, `tareas info`, `anuncios`, `archivos`, `archivos download` (≤50MB), `calendario`, `inbox`, `doctor`, `schema`, `config show`, `config path`, `auth status`, `auth canvas clear`, `auth logout` | None — runs silently |
| T2 (confirm) | `auth login`, `auth canvas set-token`, `tramite generar`, `archivos download` (>50MB) | Show preview, require `--yes` (or interactive confirm in TTY) |

`tramite generar` is T2 because it creates a real billable obligation in
Wiener's billing system. Always preview the monto + concepto before confirming.

## Common Workflows

### Check today's schedule
```bash
wiener horario hoy --json
# → { ok: true, fecha, dia, bloques: [...] }
```

### Find what class is happening right now
```bash
wiener horario ahora --json
# → { ok: true, ahora: bloque|null, proximo: bloque|null }
```

### Get current period grades
```bash
wiener notas --json
# defaults to current periodo. Specify with --periodo 2026-I
```

### Check pending Canvas assignments
```bash
wiener tareas --estado pending --json
wiener tareas hoy --json   # only those due today or overdue
```

### See what's due this week
```bash
wiener calendario --dias 7 --json
```

### Download all course materials for a class
```bash
wiener cursos --json | jq -r '.cursos[] | select(.code=="AC4061") | .id' | \
  xargs -I {} wiener archivos --curso {} --json | \
  jq -r '.archivos[] | "\(.id) \(.name)"' | \
  while read id name; do wiener archivos download "$id" --out "./$name"; done
```

### Set up Canvas access (one-time, manual)
```bash
# 1. User opens https://campus.uwiener.edu.pe/profile/settings in their browser
# 2. Logs in via Microsoft Entra
# 3. Under "Approved Integrations" → "+ New Access Token"
# 4. Copies the token (shown once)
wiener auth canvas set-token <token>
# → validates against /api/v1/users/self, stores in OS keychain
```

### Diagnostic before any agent operation
```bash
wiener doctor --json
# → { ok: true, checks: [{name, ok, detail}, ...] }
# Surfaces: network reachability, intranet session validity, canvas token
# validity, csrfToken still 9144AF7, dead-domain bug presence.
```

### Composability with kai/jq pipelines
```bash
# "Did my AC4061 grade come in?"
wiener notas --json | jq '.cursos[] | select(.codigo=="AC4061") | {nombre, nota_final, estado}'

# "Who's my Tuesday morning teacher?"
wiener horario --json | jq '.dias.M | map(select(.time_start=="07:00")) | .[].teacher'

# Daily morning brief
wiener horario hoy --json && wiener tareas hoy --json && wiener pagos pendientes --json
```

## Gotchas

1. **Two passwords**: intranet password ≠ Microsoft/Canvas password. If user
   only has intranet access, Canvas commands fail with `error.code = "canvas-not-configured"`.
   Suggest manual token generation flow.

2. **Wrong-password 200**: intranet returns HTTP 200 for bad credentials with
   `estado: "0"` in JSON. CLI handles this — no special agent action needed.

3. **Session expiry**: intranet ASP session typically lasts ~30 min idle. CLI
   detects expiry via the `SiguNet.htm` NXDOMAIN-redirect signature, wipes
   stored session, returns `error.code = "auth-expired"`. Agent should run
   `wiener auth login` to re-auth (T2, requires interactive confirmation).

4. **`csrfToken` constant**: a hard-coded `csrfToken=9144AF7` exists in the
   intranet's login JS. CLI re-scrapes on each session in case Wiener IT
   rotates it. If `wiener doctor` reports `csrf-token: not 9144AF7`, the CLI
   has adapted automatically — no action needed; just informational.

5. **Canvas rate limit**: 3000 req/hour per token. CLI tracks via
   `X-Canvas-Meta` `rlr=` header. On approaching limit (rlr < 50), commands
   surface a warning in `--verbose` mode but continue.

6. **Pagination**: Canvas commands listing N items follow `Link: rel="next"`
   automatically. For very large lists, use `--ndjson` to stream instead of
   buffering.

7. **No bulk write**: `tramite generar` is rate-limited to 1/min internally to
   prevent accidental fan-out. Even with `--yes`.

8. **Account scope**: each `wiener` session is bound to one `--profile` (default
   `default`). Multi-account is supported but requires explicit profile naming.

9. **TLS strict**: CLI never disables cert verification. If Wiener's certs
   ever break, file an issue rather than working around.

10. **Dead `sso.wienergroup.com` domain**: Wiener's intranet has a known bug
    where unauth deep-links 302-redirect to a meta-refresh into the dead
    `sso.wienergroup.com` domain. CLI detects this signature and treats it as
    auth-failure. Real browser users hit a Chrome error page in this case.

## Environment

| Var | Required | Description |
|-----|----------|-------------|
| `WIENER_INTRANET_USER` | No | Auto-login bootstrap. Format: letter + 9 digits. |
| `WIENER_INTRANET_PASS` | No | Auto-login bootstrap. Held in memory only. |
| `WIENER_INTRANET_PERFIL` | No | `A` (Alumno, default), `D` (Docente), `P` (Administrativo). |
| `WIENER_CANVAS_TOKEN` | No | Per-invocation Canvas token override. |
| `WIENER_PROFILE` | No | Default profile name (default `default`). |
| `WIENER_CONFIG_DIR` | No | Override `~/.wiener`. |

## Files

- `~/.wiener/config.json` — global config
- `~/.wiener/audit.jsonl` — append-only audit log of all writes (and verbose reads)
- `~/.wiener/<profile>/` — per-profile cache (CSRF token, periodos, doctor results)
- macOS Keychain items: `wiener-cli.intranet.<profile>`, `wiener-cli.canvas.<profile>`

## Schema introspection

Every command publishes its JSON I/O schema for runtime discovery:

```bash
wiener schema notas
# → { command: "notas", args: {...}, output_schema: {...} }
wiener schema --list
# → { commands: ["notas", "horario", ...] }
```

Agents should call `wiener schema <cmd>` instead of relying on `--help` text
when constructing complex `--params '<json>'` invocations.

## When NOT to use this CLI

- Paying tuition or trámite obligations — generate the order with `wiener
  tramite generar` then pay in the user's bank app.
- Course enrollment / matrícula — separate portal at `matricula.uwiener.edu.pe`,
  not in scope.
- Anything involving another student's data — the CLI only operates on the
  authenticated user's own records.
- Bypassing Microsoft Entra MFA — if the user's Canvas requires MFA, manual
  token generation is mandatory; CLI cannot automate it.
