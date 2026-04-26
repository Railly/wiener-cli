// PHASE C WILL REPLACE — stub for Phase D
import type { CanvasSubmission } from "../../../types/canvas.js";

export async function getMySubmissions(): Promise<CanvasSubmission[]> {
  return [
    {
      assignment_id: 964440,
      course_id: 131067,
      score: 17,
      grade: "17",
      submitted_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      graded_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      workflow_state: "graded",
      assignment: {
        id: 964440,
        course_id: 131067,
        name: "Práctica calificada 1",
        due_at: null,
        points_possible: 20,
        submission_types: ["online_upload"],
        html_url:
          "https://campus.uwiener.edu.pe/courses/131067/assignments/964440",
      },
    },
  ];
}
