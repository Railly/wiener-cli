export function isColorEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}
