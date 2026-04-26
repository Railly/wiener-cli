export function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

export function isNoInput(flags: { noInput?: boolean }): boolean {
  return flags.noInput === true || !isTTY();
}
