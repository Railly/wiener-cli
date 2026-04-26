import type { IntranetSession, PerfilData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parsePerfil } from "../../parsers/perfil-table.ts";
import { IntranetClient } from "./client.ts";

const PERFIL_PATH = "/Alumno/DatosPersonales/actualizarDatos.asp";

export async function fetchPerfil(session: IntranetSession): Promise<PerfilData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(PERFIL_PATH);
    return parsePerfil(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch perfil: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
