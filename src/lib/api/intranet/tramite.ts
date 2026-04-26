import type { IntranetSession, TramiteData } from "../../../types/intranet.ts";
import { WienerError } from "../../errors.ts";
import { parseTramite } from "../../parsers/tramite-table.ts";
import { IntranetClient } from "./client.ts";

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

const TRAMITE_FORM_PATH = "/Alumno/orden_pago/orden_pago.asp";
const TRAMITE_LIST_PATH = "/Alumno/tramiteAcademico/inicio.asp";

export async function fetchTramiteTipos(session: IntranetSession): Promise<TramiteTipo[]> {
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });

  const response = await client.fetch(TRAMITE_FORM_PATH);
  const html = response.text;

  const tipos: TramiteTipo[] = [];
  const selectMatch = html.match(/<select[^>]*>([\s\S]*?)<\/select>/i);
  if (selectMatch) {
    const optionRegex = /<option\s+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
    let m = optionRegex.exec(selectMatch[1]);
    while (m !== null) {
      const value = m[1].trim();
      const label = m[2].trim();
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
  session: IntranetSession,
): Promise<TramitePreview> {
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });

  const body = new URLSearchParams();
  body.set("TipoTramite", tipo);
  body.set("preview", "1");

  const response = await client.fetch(TRAMITE_FORM_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const html = response.text;

  const montoMatch = html.match(/Monto[^:]*:\s*S\/\.?\s*([\d.,]+)/i);
  const conceptoMatch = html.match(/Concepto[^:]*:\s*([^\n<]+)/i);
  const vencimientoMatch = html.match(/Vencimiento[^:]*:\s*([\d/]+)/i);

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
  session: IntranetSession,
): Promise<TramiteResult> {
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });

  const body = new URLSearchParams();
  body.set("TipoTramite", tipo);
  body.set("Confirmar", "1");

  const response = await client.fetch(TRAMITE_FORM_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const html = response.text;

  const ordenMatch = html.match(/Orden\s+(?:de\s+)?Pago\s+(?:N[°º]?\.?\s*)?(OP-[\d-]+|\d+)/i);
  const montoMatch = html.match(/Monto[^:]*:\s*S\/\.?\s*([\d.,]+)/i);
  const conceptoMatch = html.match(/Concepto[^:]*:\s*([^\n<]+)/i);
  const vencimientoMatch = html.match(/Vencimiento[^:]*:\s*([\d/]+)/i);

  if (!ordenMatch) {
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

export async function fetchTramites(session: IntranetSession): Promise<TramiteData> {
  const client = new IntranetClient({
    aspCookieName: session.aspCookieName,
    aspCookieValue: session.aspCookieValue,
  });
  const response = await client.fetch(TRAMITE_LIST_PATH);
  return parseTramite(response.text);
}
