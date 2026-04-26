import pc from "picocolors";

export function renderNotImplemented(command: string): void {
  console.log(pc.dim(`${command} panorama view — not yet implemented (Phase E)`));
  console.log(pc.dim("Run `wiener hoy` for today's schedule when intranet is configured."));
}
