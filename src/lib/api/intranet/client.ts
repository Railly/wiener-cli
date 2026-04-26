// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import { WienerError } from "../../errors.ts";
import type { IntranetSession } from "../../../types/intranet.ts";

const INTRANET_BASE = "https://intranet.uwiener.edu.pe";
const SIGUNET_SIGNAL = "SiguNet.htm";

export interface IntranetFetchOptions {
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
}

export interface IntranetResponse {
  text: string;
  status: number;
}

export async function intranetFetch(
  path: string,
  session: IntranetSession,
  options: IntranetFetchOptions = {},
): Promise<IntranetResponse> {
  const url = `${INTRANET_BASE}${path}`;
  const cookieHeader = `${session.aspCookieName}=${session.aspCookieValue}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Cookie: cookieHeader,
        "User-Agent": "wiener-cli/0.1.0",
        ...(options.headers ?? {}),
      },
      body: options.body,
      redirect: "manual",
    });
  } catch (e) {
    throw new WienerError("network-error", `Network error fetching ${path}: ${String(e)}`);
  }

  const text = await response.text();

  if (text.includes(SIGUNET_SIGNAL)) {
    throw new WienerError(
      "auth-expired",
      "Intranet session expired. Run `wiener auth login` to re-authenticate.",
      "wiener auth login",
    );
  }

  return { text, status: response.status };
}
