# wiener-cli

Agent-first CLI for Universidad Norbert Wiener (UNW) student portals.

Wraps two backends:

- **Wienernet intranet** (`intranet.uwiener.edu.pe`) — Classic ASP, cookie session. Notas, horario, asistencia, plan de estudios, pagos, trámites.
- **Canvas LMS** (`campus.uwiener.edu.pe`) — Instructure cloud (cluster335, us-east-1c), SAML2 → MS Entra. Cursos, tareas, anuncios, archivos, calendario.

Built for an agent to autonomously answer day-to-day student questions ("qué nota saqué", "qué clase tengo ahora", "qué tareas debo entregar") without manual portal navigation.

## Status

**Pre-implementation.** Recon + shaping + scaffold spec + skill draft are complete:

- `recon.md` — endpoint map, auth flows, quirks
- `shaping.md` — command surface, trust ladder, JSON contract
- `scaffold.md` — directory structure, package.json, build/test strategy
- `skill-draft.md` — agent skill template

Implementation starts after Hunter reviews the shape.

## License

Private. Personal use.
