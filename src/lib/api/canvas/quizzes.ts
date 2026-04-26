import type { CanvasQuiz } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError, WienerError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchQuizzes(courseId: number, profile = "default"): Promise<CanvasQuiz[]> {
  try {
    const token = await requireCanvasToken(profile);
    const res = await canvasFetchAll<CanvasQuiz>(
      `/api/v1/courses/${courseId}/quizzes?per_page=50`,
      { token },
    );
    return res.data;
  } catch (e) {
    if (e instanceof WienerError && e.message.includes("404")) {
      return [];
    }
    throw e;
  }
}
