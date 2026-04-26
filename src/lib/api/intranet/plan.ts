import { intranetFetch } from "./client.ts";
import { parsePlan, parsePlanAvance } from "../../parsers/plan-table.ts";
import type { IntranetSession, PlanData, PlanAvanceData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";

const PLAN_PATH = "/Alumno/matricula/plandeestudio/plandeEstudio.asp";
const PLAN_AVANCE_PATH = "/Alumno/matricula/plandeestudio/plandeEstudioVigente.asp";

export async function fetchPlan(session: IntranetSession): Promise<PlanData> {
  try {
    const response = await intranetFetch(PLAN_PATH, session);
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
    const response = await intranetFetch(PLAN_AVANCE_PATH, session);
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
