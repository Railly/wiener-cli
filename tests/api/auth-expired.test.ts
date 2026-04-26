import { describe, expect, it } from "bun:test";
import { isAuthExpired } from "../../src/lib/parsers/auth-expired-detector.js";

describe("isAuthExpired", () => {
  it("detects SiguNet.htm in response body", () => {
    expect(isAuthExpired('<meta http-equiv="refresh" content="0;url=/Alumno/SiguNet.htm">')).toBe(
      true,
    );
  });

  it("detects sso.wienergroup.com in response body", () => {
    expect(isAuthExpired("Redirecting to https://sso.wienergroup.com/login...")).toBe(true);
  });

  it("does NOT flag sso.asp as expired (it's the login page, not the expiry redirect)", () => {
    // Per recon.md, only SiguNet.htm is the dead redirect. sso.asp is the normal login.
    expect(isAuthExpired("", "https://intranet.uwiener.edu.pe/sso.asp")).toBe(false);
  });

  it("detects SiguNet.htm in final URL", () => {
    expect(isAuthExpired("", "https://intranet.uwiener.edu.pe/Alumno/SiguNet.htm")).toBe(true);
  });

  it("returns false for normal authenticated page", () => {
    expect(
      isAuthExpired(
        "<html><body>Notas del alumno</body></html>",
        "https://intranet.uwiener.edu.pe/Alumno/Datosacademicos/notas/NOTAS.asp",
      ),
    ).toBe(false);
  });

  it("returns false for empty response without redirect signals", () => {
    expect(isAuthExpired("")).toBe(false);
  });
});
