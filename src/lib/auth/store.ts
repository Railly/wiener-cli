// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import type { IntranetSession } from "../../types/intranet.ts";
import { WienerError } from "../errors.ts";

const SESSION_FILE_PREFIX = `${process.env["HOME"] ?? "~"}/.wiener`;

export async function loadIntranetSession(profile = "default"): Promise<IntranetSession> {
  const filePath = `${SESSION_FILE_PREFIX}/${profile}/intranet-session.json`;
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      throw new WienerError(
        "auth-required",
        "No intranet session found. Run `wiener auth login` first.",
        "wiener auth login",
      );
    }
    const session = (await file.json()) as IntranetSession;
    return session;
  } catch (e) {
    if (e instanceof WienerError) throw e;
    throw new WienerError(
      "auth-required",
      "No intranet session found. Run `wiener auth login` first.",
      "wiener auth login",
    );
  }
}

export async function saveIntranetSession(
  session: IntranetSession,
  profile = "default",
): Promise<void> {
  const dir = `${SESSION_FILE_PREFIX}/${profile}`;
  const filePath = `${dir}/intranet-session.json`;
  await Bun.write(filePath, JSON.stringify(session, null, 2));
}

export async function clearIntranetSession(profile = "default"): Promise<void> {
  const filePath = `${SESSION_FILE_PREFIX}/${profile}/intranet-session.json`;
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath);
  } catch {
    // ignore missing
  }
}
