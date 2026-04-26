import type { WienerConfig } from "../../../types/config.js";
import { DEFAULT_CONFIG } from "../../../types/config.js";
import { AuthExpiredError, NetworkError } from "../../errors.js";
import { isAuthExpired } from "../../parsers/auth-expired-detector.js";

export interface IntranetClientOptions {
  aspCookieName?: string;
  aspCookieValue?: string;
  config?: Partial<WienerConfig["intranet"]>;
}

export interface IntranetResponse {
  status: number;
  text: string;
  headers: Headers;
  url: string;
}

export class IntranetClient {
  private cookieName: string | null;
  private cookieValue: string | null;
  private config: WienerConfig["intranet"];

  constructor(opts: IntranetClientOptions = {}) {
    this.cookieName = opts.aspCookieName ?? null;
    this.cookieValue = opts.aspCookieValue ?? null;
    this.config = {
      ...DEFAULT_CONFIG.intranet,
      ...opts.config,
    };
  }

  setCookie(name: string, value: string): void {
    this.cookieName = name;
    this.cookieValue = value;
  }

  captureCookieFromHeaders(headers: Headers): void {
    const setCookieHeader = headers.get("set-cookie");
    if (!setCookieHeader) return;

    const match = /^(ASPSESSIONID[A-Z]+)=([^;]+)/i.exec(setCookieHeader);
    if (match?.[1] && match[2]) {
      this.cookieName = match[1];
      this.cookieValue = match[2];
    }
  }

  getCookieHeader(): string {
    if (!this.cookieName || !this.cookieValue) return "";
    return `${this.cookieName}=${this.cookieValue}`;
  }

  async fetch(path: string, init: RequestInit = {}): Promise<IntranetResponse> {
    const url = `${this.config.base_url}${path}`;
    const headers: Record<string, string> = {
      "User-Agent": this.config.user_agent,
      ...((init.headers as Record<string, string>) ?? {}),
    };

    const cookie = this.getCookieHeader();
    if (cookie) {
      headers.Cookie = cookie;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(this.config.request_timeout_ms),
      });
    } catch (cause) {
      throw new NetworkError(`Failed to reach intranet: ${url}`, cause);
    }

    this.captureCookieFromHeaders(response.headers);

    const text = await response.text().catch(() => "");
    const finalUrl = response.headers.get("location") ?? url;

    if (isAuthExpired(text, finalUrl)) {
      throw new AuthExpiredError();
    }

    return {
      status: response.status,
      text,
      headers: response.headers,
      url: finalUrl,
    };
  }
}

export function intranetFetch(
  path: string,
  opts: RequestInit & { client: IntranetClient },
): Promise<IntranetResponse> {
  const { client, ...init } = opts;
  return client.fetch(path, init);
}
