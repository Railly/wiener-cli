export interface CanvasSession {
  token: string;
  validatedAt: string;
  userId: string;
  primaryEmail?: string;
  name?: string;
}

export interface CanvasUser {
  id: string;
  name: string;
  primary_email?: string;
  login_id?: string;
}

export interface CanvasPaginationResult<T> {
  data: T[];
  nextUrl: string | null;
}

export interface RateLimit {
  remaining: number | null;
  requestCostEstimate: number | null;
}
