import { afterEach, describe, expect, it } from "bun:test";
import { loginIntranet } from "../../src/lib/api/intranet/login.js";

const SSO_HTML = `
<html><head></head><body>
<script>var csrfToken='9144AF7';</script>
</body></html>
`;

function makeResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html",
      ...headers,
    },
  });
}

function makeJsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loginIntranet", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("succeeds with estado=1 and sets cookie", async () => {
    let callCount = 0;

    // @ts-ignore — test mock
    globalThis.fetch = async (_input: string | URL | Request) => {
      callCount++;

      if (callCount === 1) {
        return makeResponse(SSO_HTML, 200, {
          "set-cookie": "ASPSESSIONIDCWSDCAAD=TESTVALUE123; Path=/; HttpOnly",
        });
      }
      if (callCount === 2) {
        return makeJsonResponse({ estado: "1", action: "/Alumno/ValidaAcceso.asp" });
      }
      if (callCount === 3) {
        return makeResponse("", 302, {
          "set-cookie": "ASPSESSIONIDCWSDCAAD=VALIDCOOKIE456; Path=/; HttpOnly",
          location: "/Alumno/SiguNet.asp",
        });
      }
      return makeResponse("");
    };

    const result = await loginIntranet({
      usuario: "aXXXXXXXXX",
      contrasena: "testpass",
      perfil: "A",
    });

    expect(result.codigo).toBe("aXXXXXXXXX");
    expect(result.perfil).toBe("A");
    expect(result.aspCookieName).toMatch(/^ASPSESSIONID/);
    expect(result.aspCookieValue).toBeTruthy();
  });

  it("throws auth-invalid-credentials on estado=0", async () => {
    let callCount = 0;
    // @ts-ignore — test mock
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return makeResponse(SSO_HTML);
      return makeJsonResponse({ estado: "0", action: "", mensaje: "Credenciales inválidas" });
    };

    await expect(
      loginIntranet({ usuario: "bad", contrasena: "wrong", perfil: "A" }),
    ).rejects.toThrow();
  });

  it("throws parse-error on malformed JSON response", async () => {
    let callCount = 0;
    // @ts-ignore — test mock
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return makeResponse(SSO_HTML);
      return makeResponse("NOT_JSON");
    };

    await expect(loginIntranet({ usuario: "a", contrasena: "b", perfil: "A" })).rejects.toThrow();
  });

  it("throws parse-error on unknown estado", async () => {
    let callCount = 0;
    // @ts-ignore — test mock
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return makeResponse(SSO_HTML);
      return makeJsonResponse({ estado: "99", action: "" });
    };

    await expect(loginIntranet({ usuario: "a", contrasena: "b", perfil: "A" })).rejects.toThrow();
  });

  it("handles estado=9 path", async () => {
    let callCount = 0;
    // @ts-ignore — test mock
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) return makeResponse(SSO_HTML);
      if (callCount === 2)
        return makeJsonResponse({ estado: "9", action: "/Alumno/ValidaAcceso.asp" });
      return makeResponse("", 302, {
        "set-cookie": "ASPSESSIONIDTEST=COOKIEVAL; Path=/",
        location: "/Alumno/SiguNet.asp",
      });
    };

    const result = await loginIntranet({ usuario: "u", contrasena: "p", perfil: "A" });
    expect(result.perfil).toBe("A");
  });
});
