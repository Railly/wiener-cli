import type { IntranetSession, PagosData, PagosHistorialData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parsePagos, parsePagosHistorial } from "../../parsers/pagos-table.ts";
import { IntranetClient } from "./client.ts";

const PAGOS_PATH = "/Alumno/pagos/obligaciones.asp";
const PAGOS_HISTORIAL_PATH = "/Alumno/pagos/historial.asp";

export async function fetchPagos(session: IntranetSession): Promise<PagosData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(PAGOS_PATH);
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

export async function fetchPagosHistorial(session: IntranetSession): Promise<PagosHistorialData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(PAGOS_HISTORIAL_PATH);
    return parsePagosHistorial(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "not-implemented",
      "Historial de pagos page not confirmed in recon. Try `wiener pagos` for pending obligations.",
      "The endpoint /Alumno/pagos/historial.asp may not exist. Needs validation against real session.",
    );
  }
}
