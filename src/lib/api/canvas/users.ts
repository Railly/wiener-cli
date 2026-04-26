import type { CanvasUser } from "../../../types/canvas.js";
import { canvasFetch } from "./client.js";

export async function getSelf(token: string): Promise<CanvasUser> {
  const result = await canvasFetch<CanvasUser>("/api/v1/users/self", { token });
  return result.data;
}
