import type { IntranetSession, NotasData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseNotas, parsePeriodos } from "../../parsers/notas-table.ts";
import { IntranetClient } from "./client.ts";

const NOTAS_PATH = "/Alumno/Datosacademicos/notas/NOTAS.asp";

export async function fetchNotas(
  session: IntranetSession,
  periodo?: string,
): Promise<{ data: NotasData; periodos: string[] }> {
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });

  let path = NOTAS_PATH;

  if (periodo) {
    path = `${NOTAS_PATH}?periodo=${encodeURIComponent(periodo)}`;
  }

  try {
    const response = await client.fetch(path, { method: "GET" });
    const result = parseNotas(response.text);

    if (periodo && result.data.cursos.length === 0) {
      const postResponse = await client.fetch(NOTAS_PATH, {
        method: "POST",
        body: `periodo=${encodeURIComponent(periodo)}`,
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
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });
  const response = await client.fetch(NOTAS_PATH);
  return parsePeriodos(response.text);
}
