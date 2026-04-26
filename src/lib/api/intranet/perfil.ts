import { intranetFetch } from "./client.ts";
import { parsePerfil } from "../../parsers/perfil-table.ts";
import type { IntranetSession, PerfilData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const PERFIL_PATH = "/Alumno/DatosPersonales/actualizarDatos.asp";

export async function fetchPerfil(session: IntranetSession): Promise<PerfilData> {
  try {
    const response = await intranetFetch(PERFIL_PATH, session);
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
