import type { CanvasQuiz } from "../../../types/canvas.js";
import { canvasFetch, canvasFetchAll } from "./client.js";
import { WienerError } from "../../errors.js";

export async function fetchQuizzes(courseId: number): Promise<CanvasQuiz[]> {
  try {
    const res = await canvasFetchAll<CanvasQuiz>(`/api/v1/courses/${courseId}/quizzes`, {
      queryParams: { per_page: 50 },
    });
    return res.data;
  } catch (e) {
    if (e instanceof WienerError && e.message.includes("404")) {
      return [];
    }
    throw e;
  }
}
