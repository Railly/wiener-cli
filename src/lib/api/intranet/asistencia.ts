import type { AsistenciaData, IntranetSession } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseAsistencia } from "../../parsers/asistencia-table.ts";
import { intranetFetch } from "./client.ts";

const ASISTENCIA_PATH = "/Alumno/Datosacademicos/Asistencia/asistencia.asp";

export async function fetchAsistencia(session: IntranetSession): Promise<AsistenciaData> {
  try {
    const response = await intranetFetch(ASISTENCIA_PATH, session);
    return parseAsistencia(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch asistencia: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
