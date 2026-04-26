import type { IntranetSession, MatriculaData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseMatricula } from "../../parsers/matricula-table.ts";
import { IntranetClient } from "./client.ts";

const MATRICULA_PATH = "/Alumno/matricula/registrarMatricula/fichaMatricula.asp";

export async function fetchMatricula(session: IntranetSession): Promise<MatriculaData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(MATRICULA_PATH);
    return parseMatricula(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch ficha de matrícula: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
