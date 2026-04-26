import { intranetFetch } from "./client.ts";
import { parseHistorial } from "../../parsers/historial-table.ts";
import type { IntranetSession, HistorialData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const HISTORIAL_PATH = "/Alumno/matricula/HistorialAcademico/HistorialAcademico.asp";

export async function fetchHistorial(session: IntranetSession): Promise<HistorialData> {
  try {
    const response = await intranetFetch(HISTORIAL_PATH, session);
    return parseHistorial(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch historial: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
