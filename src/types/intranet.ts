export interface IntranetSession {
  aspCookieName: string;
  aspCookieValue: string;
  perfil: "A" | "D" | "P";
  codigo: string;
  capturedAt: string;
}

export interface IntranetAuthResult {
  ok: boolean;
  perfil: "A" | "D" | "P";
  codigo: string;
  expiresAt?: string;
}

export interface AuthenticateResponse {
  estado: string;
  action: string;
  mensaje?: string;
}
