import { intranetFetch } from "./client.ts";
import { parseExamenes } from "../../parsers/examenes-table.ts";
import type { IntranetSession, ExamenesData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const EXAMENES_PATH = "/Alumno/DatosAcademicos/RolExamenes/RolExamenes.asp";

export async function fetchExamenes(session: IntranetSession): Promise<ExamenesData> {
  try {
    const response = await intranetFetch(EXAMENES_PATH, session);
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
