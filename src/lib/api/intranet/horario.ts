import { intranetFetch } from "./client.ts";
import { parseHorario } from "../../parsers/horario-table.ts";
import type { IntranetSession, HorarioData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const HORARIO_PATH = "/Alumno/horarios/HorarioMatriculado/horario.asp";

export async function fetchHorario(session: IntranetSession): Promise<HorarioData> {
  try {
    const response = await intranetFetch(HORARIO_PATH, session);
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
