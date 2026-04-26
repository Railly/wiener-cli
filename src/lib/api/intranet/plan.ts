import type { IntranetSession, PlanAvanceData, PlanData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parsePlan, parsePlanAvance } from "../../parsers/plan-table.ts";
import { IntranetClient } from "./client.ts";

const PLAN_PATH = "/Alumno/matricula/plandeestudio/plandeEstudio.asp";
const PLAN_AVANCE_PATH = "/Alumno/matricula/plandeestudio/plandeEstudioVigente.asp";

export async function fetchPlan(session: IntranetSession): Promise<PlanData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(PLAN_PATH);
    return parsePlan(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch plan de estudios: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}

export async function fetchPlanAvance(session: IntranetSession): Promise<PlanAvanceData> {
  try {
    const client = new IntranetClient({
      aspCookieName: session.aspCookieName,
      aspCookieValue: session.aspCookieValue,
    });
    const response = await client.fetch(PLAN_AVANCE_PATH);
    return parsePlanAvance(response.text);
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "parse-error",
      `Failed to fetch avance de plan: ${String(e)}`,
      "Run `wiener doctor` to check session health",
    );
  }
}
