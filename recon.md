---
type: cli-recon
target: Universidad Norbert Wiener (Wienernet intranet + Canvas LMS campus)
created: 2026-04-26
status: recon-complete
auth-type: dual (cookie ASP + Bearer Canvas/SAML2)
has-official-api: partial (Canvas REST API present and standard, intranet has none)
account-tested: aXXXXXXXXX (Alumno, Lima Centro)
---

# Wiener — Recon Report

## Overview

Universidad Norbert Wiener has **two separate student portals** with independent
auth, joined only by a sidebar link in the intranet:

1. **Intranet "Wienernet"** at `intranet.uwiener.edu.pe` — Classic ASP, internal
   admin/academic data (notas, horario, asistencia, plan de estudios, pagos,
   trámites, biblioteca). Cookie-based session, no public API.
2. **Campus "Aula Virtual"** at `campus.uwiener.edu.pe` — Canvas LMS by
   Instructure (cluster335, us-east-1c), accessed via SAML2 to Microsoft Entra
   ID (tenant `e0f9bc13-8926-42ca-b338-52a0a69d202c`). Full standard Canvas REST
   API exposed at `/api/v1/`. Personal access token model.

The intranet does NOT auto-redirect to campus on login (despite Hunter's
recollection). Reaching campus from intranet is a manual sidebar click that
opens a separate auth chain.

Side-domains in the same ecosystem (out of scope for v1, recon flagged):
- `matricula.uwiener.edu.pe` — separate matrícula app
- `uwiener.sofydoc.com` — SaaS doc-tracking
- `recuperarcontrasena.uwiener.edu.pe` — Office 365 password reset
- `pagos.uwiener.edu.pe:8443` — payments portal (banking integration)

## Official API

**Canvas (campus)**: Yes. Standard Instructure Canvas LMS REST API at
`/api/v1/*`. Confirmed live (401 on unauthenticated `/api/v1/users/self` with
`WWW-Authenticate: Bearer realm="canvas-lms"`). Full surface documented at
[Canvas LMS REST API](https://canvas.instructure.com/doc/api/). Auth: personal
access tokens generated from `/profile/settings` if institution allows.

**Intranet (Wienernet)**: No. Classic ASP server-rendered. CLI must scrape +
replay XHR endpoints used by the portal's own JS. Endpoints are stable enough
(unchanged ASP convention) but no contract guarantees.

## Authentication

### Intranet — ASP cookie session

Login is a **2-step XHR + form-POST dance**, not a single submit:

**Step 1 — XHR auth check**
```
POST https://intranet.uwiener.edu.pe/login/dev/autenticate.asp
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest
Referer: https://intranet.uwiener.edu.pe/sso.asp

pUsuario=<user>&pContrasenia=<pass>&pPerfil=A&pInstitucion=51&csrfToken=9144AF7
```
Response: `application/json` `{ estado, action, mensaje? }`.
- `estado === "1"` → proceed to step 2 with `data.action`.
- `estado === "0"` → wrong creds, render `mensaje`.
- `estado === "9"` → alternate path, post directly to `data.action`.

`csrfToken=9144AF7` is **hard-coded** in inline JS of `sso.asp`. Verified
constant across two page loads. Treat as deploy-time constant; CLI should
re-scrape from page source on each session in case of rotation.

**Step 2 — actual session creation**
```
POST https://intranet.uwiener.edu.pe/Alumno/ValidaAcceso.asp
Content-Type: application/x-www-form-urlencoded

lgnUserName=<user>&lgnPassword=<pass>&lgnddlPerfiles=A&lgnddlInstituciones=51
```
Server responds `302 → /Alumno/SiguNet.asp` and sets `ASPSESSIONID*=...`
(httpOnly, Secure). That cookie is the **only** auth credential — keep it for
all subsequent requests.

Perfil values: `A`=Alumno, `D`=Docente, `P`=Administrativo. Institución
hidden=`51`.

Cookie name varies per request pool: format `ASPSESSIONID` + 8 random alpha
chars (e.g. `ASPSESSIONIDCWSDCAAD`). CLI must capture whichever one comes back.

### Campus (Canvas) — SAML2 → MS Entra → Bearer token

Two viable auth paths, in order of preference for CLI use:

1. **Personal access token** (preferred, native Canvas).
   - Generate manually at `https://campus.uwiener.edu.pe/profile/settings`
     under "Approved Integrations" → "+ New Access Token".
   - **Status of this option for Wiener students: UNKNOWN**. Could not verify
     in recon (blocked at MS Entra password step — student MS password is
     distinct from intranet password and was not in scope).
   - Use as `Authorization: Bearer <token>` on every API call.
   - 3000 req/hour default rate limit (Instructure standard); track via
     `X-Canvas-Meta` header `rlr=` field.

2. **Browser cookie extraction** (fallback if tokens are disabled).
   - User logs in once via browser, CLI extracts `_normandy_session` cookie
     from Chrome/Firefox profile.
   - For API calls that need it, also extract `_csrf_token` cookie, URL-decode,
     pass as `X-CSRF-Token` header.
   - Brittle: cookies expire, browser updates can break decryption. Fine as a
     bootstrap path until token generation is confirmed.

3. **Canvas-native form login** (`/login/canvas`) — TESTED, does not work for
   Wiener students. Returns 400 with intranet credentials. The pseudonym DB
   isn't populated for Wiener accounts; this form is for Canvas-local admins
   only.

4. **Programmatic SAML2 → Entra dance** — possible but explicitly NOT pursued.
   Microsoft's Entra login pages use rotating client-side challenges, sometimes
   trigger MFA/captcha, and violate the spirit of "agent-first" (it's brittle
   browser automation, not API). Use option 1 or 2.

## Endpoints

### Intranet (scraping targets)

| Method | Path | Purpose | Auth | Notes |
|--------|------|---------|------|-------|
| GET | `/sso.asp` | Login page (also source of `csrfToken`) | None | Sets ASP cookie |
| POST | `/login/dev/autenticate.asp` | Step 1 auth check (returns JSON) | csrfToken + creds | XHR-style |
| POST | `/Alumno/ValidaAcceso.asp` | Step 2 session creation | creds | 302 to SiguNet.asp |
| GET | `/Alumno/SiguNet.asp` | Post-login frameset shell | ASP cookie | Auth probe |
| GET | `/Alumno/body.asp` | Sidebar menu source | ASP cookie | |
| GET | `/Alumno/Datosacademicos/notas/NOTAS.asp` | Grade view (table) | ASP cookie | Periodo selector |
| GET | `/Alumno/horarios/HorarioMatriculado/horario.asp` | Weekly schedule (table) | ASP cookie | 7-col grid |
| GET | `/Alumno/Datosacademicos/Asistencia/asistencia.asp` | Attendance | ASP cookie | |
| GET | `/Alumno/matricula/plandeestudio/plandeEstudio.asp` | Plan de estudios | ASP cookie | |
| GET | `/Alumno/matricula/plandeestudio/plandeEstudioVigente.asp` | Avance académico | ASP cookie | |
| GET | `/Alumno/matricula/HistorialAcademico/HistorialAcademico.asp` | Historial completo | ASP cookie | |
| GET | `/Alumno/DatosAcademicos/RolExamenes/RolExamenes.asp` | Calendario de exámenes | ASP cookie | |
| GET | `/Alumno/pagos/obligaciones.asp` | Deudas/cuentas pendientes | ASP cookie | |
| GET | `/Alumno/orden_pago/orden_pago.asp` | Generar orden de pago para trámite | ASP cookie | T2 — write op |
| GET | `/Alumno/matricula/registrarMatricula/fichaMatricula.asp` | Ficha de matrícula | ASP cookie | |
| GET | `/Alumno/DatosPersonales/actualizarDatos.asp` | Datos del estudiante | ASP cookie | |
| GET | `/Alumno/biblioteca/biblioteca.asp` | Acceso biblioteca | ASP cookie | |
| GET | `/CerrarSesion.asp?p=alu` | Logout (rotates ASP cookie) | ASP cookie | |

All `?ruta=...` params accepted by `body.asp` are equivalent to direct paths
(verified). The CLI should hit direct paths and skip the iframe wrapper.

### Campus (Canvas REST API)

Standard Instructure surface. Most-relevant for v1 student-facing CLI:

| Method | Path | Purpose | Notes |
|--------|------|---------|-------|
| GET | `/api/v1/users/self` | Current user profile | Identity probe |
| GET | `/api/v1/users/self/favorites/courses` | Pinned courses (dashboard) | Paginated |
| GET | `/api/v1/courses?enrollment_state=active` | All active enrollments | Paginated |
| GET | `/api/v1/courses/:id` | Course detail | |
| GET | `/api/v1/courses/:id/modules` | Modules + items | Paginated |
| GET | `/api/v1/courses/:id/assignments` | Assignments list | Includes due dates |
| GET | `/api/v1/courses/:id/assignments/:aid` | Assignment detail | Description, rubric |
| GET | `/api/v1/courses/:id/assignments/:aid/submissions/self` | Own submission | Score, grade, comments |
| GET | `/api/v1/users/self/upcoming_events` | Calendar / due soon | Quick "what's due" |
| GET | `/api/v1/users/self/todo` | Canvas todo list | Quick action items |
| GET | `/api/v1/announcements?context_codes[]=course_:id` | Course announcements | Paginated |
| GET | `/api/v1/courses/:id/files` | Course files tree | Browse/download |
| GET | `/api/v1/files/:id` | File metadata + download URL | Download materials |
| GET | `/api/v1/conversations` | Inbox messages | |
| POST | `/api/v1/courses/:id/discussion_topics/:tid/entries` | Post to discussion | T2 — write op |
| POST | `/api/v1/courses/:id/assignments/:aid/submissions` | Submit assignment | T2 — write op |

Pagination: `Link` header with `rel="next"` (RFC 5988). Use `per_page=100` (max
default 100) and follow `next` until exhausted.

## Rate Limits

- **Canvas**: 3000 req/hour per token (Instructure default). Track `X-Canvas-Meta`
  `rlr=<float>` header — descending counter, lower = more remaining.
- **Intranet**: No explicit rate limit headers seen during recon (1 wrong-pass +
  1 success). Exercise restraint; ASP backends often have IIS-level throttles
  that are invisible until you hit them. CLI default: 1 req/sec, exponential
  backoff on 5xx.

## Quirks & Gotchas

1. **Two distinct passwords**: Intranet password ≠ Microsoft Entra password.
   Hunter's account uses different credentials for each. CLI must hold both
   (or only one, with Canvas degrading to "not configured").

2. **`csrfToken=9144AF7` is hard-coded constant**, NOT per-session. Re-scrape
   from `sso.asp` on each session in case Wiener IT rotates it.

3. **Frameset trap**: post-login lands on `/Alumno/SiguNet.asp` which is a
   `<frameset>` with `head.asp` + `body.asp`. CLI auth probe should check for
   "frameset" in body OR a 200 to a known authed page like
   `/Alumno/Datosacademicos/notas/NOTAS.asp` — NOT just status 200.

4. **Production bug — NXDOMAIN redirect**: any unauth deep-link 302s to
   `/Alumno/SiguNet.htm` (`.htm`, not `.asp`) which has a meta-refresh to
   `https://sso.wienergroup.com/...` — that domain is dead (NXDOMAIN). Means
   real users hit a Chrome error page on session expiry. CLI signal: if
   response contains "SiguNet.htm" → not authed, redirect-loop, do NOT follow.

5. **Wrong-password 200**: `autenticate.asp` returns HTTP 200 even on bad
   credentials, with `{ estado: "0", mensaje: "..." }`. CLI must parse the JSON
   `estado` field, not rely on HTTP status.

6. **Cookie name varies**: `ASPSESSIONID` + 8 random chars. Cannot hard-code the
   cookie name; capture whichever cookie matching `^ASPSESSIONID` comes back.

7. **No CSRF on intranet writes** beyond the static `csrfToken=9144AF7`. If
   Wiener IT ever fixes this, the CLI will silently break on write operations.
   Audit log is the only safety net.

8. **Canvas SAML SLO does not invalidate Microsoft session**. Logging out of
   Canvas only kills the Canvas SP cookie; visiting campus again silently
   re-authenticates if the browser/agent still holds an MS session cookie.
   Relevant only if CLI ever does cookie-based Canvas auth.

9. **Side domains likely have separate auth**: matricula.uwiener.edu.pe,
   sofydoc, pagos:8443 — out of scope for v1.

10. **Notas page Period selector**: defaults to "-- Seleccione --" with empty
    table. CLI must POST/GET with explicit period (e.g. `2026-I`, `2025-II`)
    to get rows. Available periods scraped from select options.

## Screenshots

Captured in `screenshots/01-15-*.png`. Reference them inline in shaping/scaffold
docs as needed. Key ones:
- `06-intranet-body-menu.png` — full sidebar with all menu items
- `13-intranet-horario.png` — schedule table (parsing target reference)
- `07-microsoft-saml-login.png` — Entra login wall blocking Canvas recon

## Open Questions (for future recon passes)

1. **Microsoft Entra password rotation**: Wiener IT may rotate the MS Entra
   password for student accounts independently of the intranet password.
   Path to recover: reset via `https://recuperarcontrasena.uwiener.edu.pe`.
   The intranet password and Microsoft password are distinct credentials.
2. Where does the alleged "intranet → campus auto-redirect" happen? Not seen in
   recon. Maybe specific deep-links or first-time-per-semester flows.
3. Does `csrfToken=9144AF7` actually rotate? Monthly probe.
4. Side domains (matricula, sofydoc, pagos): independent auth or shared cookie?
5. Frame-redirect-to-NXDOMAIN bug: report to Wiener IT? Or leave silent and
   exploit as auth-failure signal in CLI?
