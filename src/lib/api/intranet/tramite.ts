import type { IntranetSession, TramiteData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseTramite } from "../../parsers/tramite-table.ts";
import { intranetFetch } from "./client.ts";

// Recon flagged but didn't fully enter tramite page — best guess at path
const TRAMITE_PATH = "/Alumno/tramiteAcademico/inicio.asp";

export async function fetchTramites(session: IntranetSession): Promise<TramiteData> {
  try {
    const response = await intranetFetch(TRAMITE_PATH, session);

    if (
      response.status === 404 ||
      response.text.includes("404") ||
      response.text.includes("not found")
    ) {
      throw new WienerError(
        "not-implemented",
        "Trámite page path not confirmed. Needs validation against real session.",
        "Try navigating to the trámite section manually and report the URL to refine this command.",
      );
    }

    return parseTramite(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch trámites: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
