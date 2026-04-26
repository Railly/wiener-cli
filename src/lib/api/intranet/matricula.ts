import type { IntranetSession, MatriculaData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseMatricula } from "../../parsers/matricula-table.ts";
import { intranetFetch } from "./client.ts";

const MATRICULA_PATH = "/Alumno/matricula/registrarMatricula/fichaMatricula.asp";

export async function fetchMatricula(session: IntranetSession): Promise<MatriculaData> {
  try {
    const response = await intranetFetch(MATRICULA_PATH, session);
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
