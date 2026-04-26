import { $ } from "bun";

export async function keychainSet(service: string, account: string, value: string): Promise<void> {
  await $`security delete-generic-password -s ${service} -a ${account}`.quiet().nothrow();
  await $`security add-generic-password -s ${service} -a ${account} -w ${value}`.quiet();
}

export async function keychainGet(service: string, account: string): Promise<string | null> {
  const result = await $`security find-generic-password -s ${service} -a ${account} -w`
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim() || null;
}

export async function keychainDelete(service: string, account: string): Promise<void> {
  await $`security delete-generic-password -s ${service} -a ${account}`.quiet().nothrow();
}
