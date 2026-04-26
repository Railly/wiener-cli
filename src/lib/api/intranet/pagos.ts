import { intranetFetch } from "./client.ts";
import { parsePagos, parsePagosHistorial } from "../../parsers/pagos-table.ts";
import type { IntranetSession, PagosData, PagosHistorialData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const PAGOS_PATH = "/Alumno/pagos/obligaciones.asp";
const PAGOS_HISTORIAL_PATH = "/Alumno/pagos/historial.asp";

export async function fetchPagos(session: IntranetSession): Promise<PagosData> {
  try {
    const response = await intranetFetch(PAGOS_PATH, session);
    return parsePagos(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch pagos: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}

export async function fetchPagosHistorial(
  session: IntranetSession,
): Promise<PagosHistorialData> {
  try {
    const response = await intranetFetch(PAGOS_HISTORIAL_PATH, session);
    return parsePagosHistorial(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    // Historial page may not exist — surface as not-implemented
    throw new WienerError(
      "not-implemented",
      "Historial de pagos page not confirmed in recon. Try `wiener pagos` for pending obligations.",
      "The endpoint /Alumno/pagos/historial.asp may not exist. Needs validation against real session.",
    );
  }
}
