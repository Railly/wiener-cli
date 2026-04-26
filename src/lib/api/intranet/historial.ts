import type { HistorialData, IntranetSession } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseHistorial } from "../../parsers/historial-table.ts";
import { IntranetClient } from "./client.ts";

const HISTORIAL_PATH = "/Alumno/matricula/HistorialAcademico/HistorialAcademico.asp";

export async function fetchHistorial(session: IntranetSession): Promise<HistorialData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(HISTORIAL_PATH);
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
