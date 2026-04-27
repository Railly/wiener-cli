import { describe, expect, it } from "bun:test";

type CheckStatus = "ok" | "warn" | "fail" | "skip";

interface DoctorCheck {
  name: string;
  label: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
  action?: string;
}

function allOk(checks: DoctorCheck[]): boolean {
  return checks.every((c) => c.status === "ok" || c.status === "skip");
}

describe("doctor check logic", () => {
  it("allOk returns true when all checks pass", () => {
    const checks: DoctorCheck[] = [
      { name: "a", label: "A", status: "ok", detail: "fine" },
      { name: "b", label: "B", status: "skip", detail: "skipped" },
    ];
    expect(allOk(checks)).toBe(true);
  });

  it("allOk returns false on fail", () => {
    const checks: DoctorCheck[] = [
      { name: "a", label: "A", status: "ok", detail: "fine" },
      { name: "b", label: "B", status: "fail", detail: "broken" },
    ];
    expect(allOk(checks)).toBe(false);
  });

  it("allOk returns false on warn", () => {
    const checks: DoctorCheck[] = [{ name: "a", label: "A", status: "warn", detail: "degraded" }];
    expect(allOk(checks)).toBe(false);
  });

  it("check has name and label fields", () => {
    const check: DoctorCheck = {
      name: "intranet-session",
      label: "intranet",
      status: "ok",
      detail: "authed",
    };
    expect(check.name).toBe("intranet-session");
    expect(check.label).toBe("intranet");
  });

  it("fail check has action field", () => {
    const check: DoctorCheck = {
      name: "intranet-session",
      label: "intranet",
      status: "fail",
      detail: "no session",
      action: "wiener auth login",
    };
    expect(check.action).toBe("wiener auth login");
  });
});
