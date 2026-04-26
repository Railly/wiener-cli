import type { IntranetSession, NotasData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseNotas, parsePeriodos } from "../../parsers/notas-table.ts";
import { intranetFetch } from "./client.ts";

const NOTAS_PATH = "/Alumno/Datosacademicos/notas/NOTAS.asp";

export async function fetchNotas(
  session: IntranetSession,
  periodo?: string,
): Promise<{ data: NotasData; periodos: string[] }> {
  let path = NOTAS_PATH;
  const method: "GET" | "POST" = "GET";
  let body: string | undefined;

  if (periodo) {
    // Try GET with query param first (most common ASP pattern)
    path = `${NOTAS_PATH}?periodo=${encodeURIComponent(periodo)}`;
  }

  try {
    const response = await intranetFetch(path, session, { method });
    const result = parseNotas(response.text);

    // If no courses found with GET, try POST (form submission)
    if (periodo && result.data.cursos.length === 0) {
      body = `periodo=${encodeURIComponent(periodo)}`;
      const postResponse = await intranetFetch(NOTAS_PATH, session, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return parseNotas(postResponse.text);
    }

    return result;
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch notas: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}

export async function fetchPeriodos(session: IntranetSession): Promise<string[]> {
  const response = await intranetFetch(NOTAS_PATH, session);
  return parsePeriodos(response.text);
}
