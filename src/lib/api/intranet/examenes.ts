import type { ExamenesData, IntranetSession } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseExamenes } from "../../parsers/examenes-table.ts";
import { IntranetClient } from "./client.ts";

const EXAMENES_PATH = "/Alumno/DatosAcademicos/RolExamenes/RolExamenes.asp";

export async function fetchExamenes(session: IntranetSession): Promise<ExamenesData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(EXAMENES_PATH);
    return parseExamenes(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch examenes: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
