import type { HorarioData, IntranetSession } from "../../../types/intranet.ts";
import { loadIntranetSession } from "../../auth/store.ts";
import { AuthRequiredError, WienerError } from "../../errors.ts";
import { parseHorario } from "../../parsers/horario-table.ts";
import { IntranetClient } from "./client.ts";

const HORARIO_PATH = "/Alumno/horarios/HorarioMatriculado/horario.asp";

export async function getHorarioMatriculado(profile = "default"): Promise<HorarioData> {
  const session = await loadIntranetSession(profile);
  if (!session) throw new AuthRequiredError("intranet");
  return fetchHorario(session);
}

export async function fetchHorario(session: IntranetSession): Promise<HorarioData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(HORARIO_PATH);
    return parseHorario(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch horario: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
