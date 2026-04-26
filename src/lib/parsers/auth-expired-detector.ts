export function isAuthExpired(responseText: string, finalUrl?: string): boolean {
  // SiguNet.htm (not .asp) is the dead-domain redirect (auth-expired signal per recon.md)
  if (responseText.includes("SiguNet.htm")) return true;
  if (responseText.includes("sso.wienergroup.com")) return true;
  // A redirect TO sso.asp from a protected page = expired (but sso.asp itself is fine)
  // Only flag if the final URL is sso.asp AND the response text looks like the login page
  if (finalUrl?.includes("SiguNet.htm")) return true;
  return false;
}
