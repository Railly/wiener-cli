// IMPLEMENTED IN PHASE E — refine in Phase B if needed.
// Based on recon: GET /Alumno/orden_pago/orden_pago.asp (form page)
// POST to the form action to generate the orden de pago.

export interface TramiteTipo {
  value: string;
  label: string;
  monto?: string;
  concepto?: string;
}

export interface TramitePreview {
  tipo: string;
  tipoLabel: string;
  concepto: string;
  monto: string;
  vencimiento: string;
}

export interface TramiteResult {
  orden_id: string;
  monto: string;
  concepto: string;
  vencimiento: string;
}

const INTRANET_BASE = process.env.WIENER_INTRANET_BASE_URL ?? "https://intranet.uwiener.edu.pe";
const TRAMITE_FORM_PATH = "/Alumno/orden_pago/orden_pago.asp";

export async function fetchTramiteTipos(
  aspCookieName: string,
  aspCookieValue: string,
): Promise<TramiteTipo[]> {
  const url = `${INTRANET_BASE}${TRAMITE_FORM_PATH}`;
  const response = await fetch(url, {
    headers: {
      Cookie: `${aspCookieName}=${aspCookieValue}`,
      "User-Agent": "wiener-cli/0.1.0",
    },
  });

  if (!response.ok) {
    const { WienerError } = await import("../../errors.ts");
    throw new WienerError("network-error", `Intranet ${response.status}: ${TRAMITE_FORM_PATH}`);
  }

  const html = await response.text();

  // Detect session expiry: SiguNet.htm signature per recon
  if (html.includes("SiguNet.htm")) {
    const { WienerError } = await import("../../errors.ts");
    throw new WienerError(
      "auth-expired",
      "Intranet session expired. Please run `wiener auth login`.",
      "wiener auth login",
    );
  }

  // Parse <select> options from the tramite form
  // The select element name will be something like "TipoTramite" or similar
  // Using a simple regex since cheerio not available in this stub
  const tipos: TramiteTipo[] = [];

  // Match <option value="X">Label</option> within the select
  const selectMatch = html.match(/<select[^>]*>([\s\S]*?)<\/select>/i);
  if (selectMatch) {
    const optionRegex = /<option\s+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
    let match: RegExpExecArray | null;
    let m = optionRegex.exec(selectMatch[1]);
    while (m !== null) {
      match = m;
      const value = match[1].trim();
      const label = match[2].trim();
      if (value && value !== "--" && value !== "0") {
        tipos.push({ value, label });
      }
      m = optionRegex.exec(selectMatch[1]);
    }
  }

  return tipos;
}

export async function fetchTramitePreview(
  tipo: string,
  aspCookieName: string,
  aspCookieValue: string,
): Promise<TramitePreview> {
  // Some tramite forms show monto dynamically — attempt a partial POST
  // to get the monto for the selected tipo. If the form doesn't support it,
  // return placeholder values that the CLI will show to the user.
  const url = `${INTRANET_BASE}${TRAMITE_FORM_PATH}`;

  const body = new URLSearchParams();
  body.set("TipoTramite", tipo);
  body.set("preview", "1");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: `${aspCookieName}=${aspCookieValue}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "wiener-cli/0.1.0",
    },
    body: body.toString(),
  });

  const html = await response.text();

  if (html.includes("SiguNet.htm")) {
    const { WienerError } = await import("../../errors.ts");
    throw new WienerError(
      "auth-expired",
      "Intranet session expired. Please run `wiener auth login`.",
      "wiener auth login",
    );
  }

  // Parse monto and concepto from response HTML
  // These fields are named based on real Wiener intranet patterns observed in recon
  const montoMatch = html.match(/Monto[^:]*:\s*S\/\.?\s*([\d.,]+)/i);
  const conceptoMatch = html.match(/Concepto[^:]*:\s*([^\n<]+)/i);
  const vencimientoMatch = html.match(/Vencimiento[^:]*:\s*([\d/]+)/i);

  // Compute vencimiento: 30 days from today as fallback
  const fallbackVenc = new Date();
  fallbackVenc.setDate(fallbackVenc.getDate() + 30);
  const vencFallback = fallbackVenc.toISOString().slice(0, 10);

  return {
    tipo,
    tipoLabel: tipo,
    concepto: conceptoMatch?.[1]?.trim() ?? "Trámite universitario",
    monto: montoMatch ? `S/. ${montoMatch[1]}` : "S/. —",
    vencimiento: vencimientoMatch?.[1]?.trim() ?? vencFallback,
  };
}

export async function submitTramiteGenerar(
  tipo: string,
  aspCookieName: string,
  aspCookieValue: string,
): Promise<TramiteResult> {
  const url = `${INTRANET_BASE}${TRAMITE_FORM_PATH}`;

  const body = new URLSearchParams();
  body.set("TipoTramite", tipo);
  body.set("Confirmar", "1");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: `${aspCookieName}=${aspCookieValue}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "wiener-cli/0.1.0",
    },
    body: body.toString(),
    redirect: "follow",
  });

  const html = await response.text();

  if (html.includes("SiguNet.htm")) {
    const { WienerError } = await import("../../errors.ts");
    throw new WienerError(
      "auth-expired",
      "Intranet session expired. Please run `wiener auth login`.",
      "wiener auth login",
    );
  }

  // Parse the resulting orden_id from the response
  // Wiener intranet typically shows "Orden de Pago N° OP-YYYY-NNNNN"
  const ordenMatch = html.match(/Orden\s+(?:de\s+)?Pago\s+(?:N[°º]?\.?\s*)?(OP-[\d-]+|\d+)/i);
  const montoMatch = html.match(/Monto[^:]*:\s*S\/\.?\s*([\d.,]+)/i);
  const conceptoMatch = html.match(/Concepto[^:]*:\s*([^\n<]+)/i);
  const vencimientoMatch = html.match(/Vencimiento[^:]*:\s*([\d/]+)/i);

  if (!ordenMatch) {
    const { WienerError } = await import("../../errors.ts");
    throw new WienerError(
      "parse-error",
      "Could not parse orden_id from intranet response. The form shape may have changed.",
      "Check the intranet manually at https://intranet.uwiener.edu.pe/Alumno/orden_pago/orden_pago.asp",
    );
  }

  const fallbackVenc = new Date();
  fallbackVenc.setDate(fallbackVenc.getDate() + 30);

  return {
    orden_id: ordenMatch[1],
    monto: montoMatch ? `S/. ${montoMatch[1]}` : "S/. —",
    concepto: conceptoMatch?.[1]?.trim() ?? "Trámite universitario",
    vencimiento: vencimientoMatch?.[1]?.trim() ?? fallbackVenc.toISOString().slice(0, 10),
  };
}

import type { IntranetSession, TramiteData } from "../../../types/intranet.ts";
import { parseTramite } from "../../parsers/tramite-table.ts";
import { intranetFetch } from "./client.ts";

const TRAMITE_LIST_PATH = "/Alumno/tramiteAcademico/inicio.asp";

export async function fetchTramites(session: IntranetSession): Promise<TramiteData> {
  const response = await intranetFetch(TRAMITE_LIST_PATH, session);
  return parseTramite(response.text);
}
