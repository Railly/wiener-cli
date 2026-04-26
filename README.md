# wiener-cli

Agent-first CLI for Universidad Norbert Wiener (UNW) student portals.

Wraps two backends:

- **Wienernet intranet** (`intranet.uwiener.edu.pe`) — Classic ASP, cookie session. Notas, horario, asistencia, plan de estudios, pagos, trámites.
- **Canvas LMS** (`campus.uwiener.edu.pe`) — Instructure cloud (cluster335, us-east-1c), SAML2 → MS Entra. Cursos, tareas, anuncios, archivos, calendario.

Built for an agent to autonomously answer day-to-day student questions ("qué nota saqué", "qué clase tengo ahora", "qué tareas debo entregar") without manual portal navigation.

## Usage (Canvas — tareas submit)

Submit an assignment from the terminal. Requires a Canvas PAT (`wiener auth canvas set-token <pat>`).

```bash
# Upload a file (online_upload)
wiener tareas submit ciencia "informe UD2" ./informe.pdf --yes

# Upload multiple files
wiener tareas submit ciencia "informe UD2" ./parte1.pdf ./parte2.pdf --yes

# Text submission
wiener tareas submit farmacia "reflexion semana 3" --type online_text_entry --text "Mi reflexión..." --yes

# URL submission
wiener tareas submit ciencia "presentacion slides" --type online_url --url https://docs.google.com/my-slides --yes

# Dry-run: preview what would be sent without submitting
wiener tareas submit ciencia "informe UD2" ./informe.pdf --dry-run

# Pipe a file path list from stdin
echo "./informe.pdf" | wiener tareas submit ciencia 42 --yes

# With submission comment
wiener tareas submit ciencia "informe UD2" ./informe.pdf --comment "Entrega versión final" --yes
```

### JSON output (for agents)

```bash
wiener tareas submit ciencia "informe" ./informe.pdf --yes --json
# {"ok":true,"data":{"submission_id":77,"workflow_state":"submitted","attempt_number":1,...}}
```

### Error codes

| Code | Meaning |
|------|---------|
| `submission-locked` | Assignment lock_at has passed |
| `submission-no-attempts` | All allowed attempts used |
| `assignment-not-found` | No matching assignment found |
| `assignment-ambiguous` | Multiple assignments match the name |
| `file-not-found` | File path does not exist |
| `submission-invalid-extension` | File extension not in assignment allowlist |
| `validation-error` | Missing required input (text/url/files) |

### Trust level

T2 — requires `--yes` or interactive confirmation. `--dry-run` shows a preview without submitting.

## Status

**Pre-implementation.** Recon + shaping + scaffold spec + skill draft are complete:

- `recon.md` — endpoint map, auth flows, quirks
- `shaping.md` — command surface, trust ladder, JSON contract
- `scaffold.md` — directory structure, package.json, build/test strategy
- `skill-draft.md` — agent skill template

Implementation starts after Hunter reviews the shape.

## License

Private. Personal use.
