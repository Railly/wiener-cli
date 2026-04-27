import type { IntranetSession } from "../../../types/intranet.js";
import type { AuthenticateResponse } from "../../../types/intranet.js";
import { WienerError } from "../../errors.js";
import { extractCsrfToken } from "../../parsers/csrf-token.js";
import { IntranetClient } from "./client.js";

export interface LoginInput {
  usuario: string;
  contrasena: string;
  perfil: "A" | "D" | "P";
}

const BASE_URL = "https://intranet.uwiener.edu.pe";

export async function loginIntranet(input: LoginInput): Promise<IntranetSession> {
  const client = new IntranetClient();

  // Step 1: GET sso.asp — capture initial ASP cookie + CSRF token
  const ssoResp = await client.fetch("/sso.asp");
  const csrfToken = extractCsrfToken(ssoResp.text);

  // Step 2: POST to autenticate.asp
  const authBody = new URLSearchParams({
    pUsuario: input.usuario,
    pContrasenia: input.contrasena,
    pPerfil: input.perfil,
    pInstitucion: "51",
    csrfToken,
  });

  const authResp = await client.fetch("/login/dev/autenticate.asp", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE_URL}/sso.asp`,
    },
    body: authBody.toString(),
  });

  let authData: AuthenticateResponse;
  try {
    authData = JSON.parse(authResp.text) as AuthenticateResponse;
  } catch {
    throw new WienerError("parse-error", "Unexpected response from autenticate.asp", {
      hint: "The intranet login endpoint may have changed",
      details: { body: authResp.text.slice(0, 200) },
    });
  }

  if (authData.estado === "0") {
    throw new WienerError("auth-invalid-credentials", authData.mensaje ?? "Invalid credentials", {
      hint: "Check your usuario and contraseña",
    });
  }

  if (authData.estado !== "1" && authData.estado !== "9") {
    throw new WienerError("parse-error", `Unexpected estado: ${authData.estado}`, {
      details: authData,
    });
  }

  // Step 3: POST to ValidaAcceso.asp
  // estado "1" → action contains the path, append /ValidaAcceso.asp per recon.md
  // estado "9" → post directly to data.action
  // Normalize action: ensure leading slash, strip trailing slash
  const rawAction = authData.action.startsWith("http")
    ? authData.action.replace(BASE_URL, "")
    : authData.action;
  const normalizedAction = `/${rawAction.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const validaPath =
    authData.estado === "1" ? `${normalizedAction}/ValidaAcceso.asp` : normalizedAction;

  const validaBody = new URLSearchParams({
    lgnUserName: input.usuario,
    lgnPassword: input.contrasena,
    lgnddlPerfiles: input.perfil,
    lgnddlInstituciones: "51",
  });

  const validaResp = await client.fetch(validaPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: validaBody.toString(),
  });

  // Server responds 302 → /Alumno/SiguNet.asp + sets cookie
  // The client captures the cookie from the redirect response
  // A 302 or 200 both work; we just need the cookie
  if (!client.getCookieHeader()) {
    throw new WienerError("auth-required", "No session cookie received after login", {
      hint: "The intranet login flow may have changed",
      details: { status: validaResp.status },
    });
  }

  const [cookieName, cookieValue] = client.getCookieHeader().split("=");
  if (!cookieName || !cookieValue) {
    throw new WienerError("auth-required", "Malformed session cookie", {
      details: { cookie: client.getCookieHeader() },
    });
  }

  return {
    aspCookieName: cookieName,
    aspCookieValue: cookieValue,
    perfil: input.perfil,
    codigo: input.usuario,
    capturedAt: new Date().toISOString(),
  };
}
