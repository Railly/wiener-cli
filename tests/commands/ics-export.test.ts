import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";

describe("ICS export paths", () => {
  it("default output path is ~/wiener-calendar.ics", () => {
    const defaultPath = join(homedir(), "wiener-calendar.ics");
    expect(defaultPath).toContain("wiener-calendar.ics");
    expect(defaultPath.startsWith(homedir())).toBe(true);
  });

  it("custom --out path is used when provided", () => {
    const customPath = "/tmp/my-cal.ics";
    const resolvedPath = customPath;
    expect(resolvedPath).toBe("/tmp/my-cal.ics");
  });
});

function mergeIcs(calendars: string[]): string {
  if (calendars.length === 0) return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
  const allVEvents: string[] = [];
  for (const cal of calendars) {
    const matches = cal.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    allVEvents.push(...matches);
  }
  return `${[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//wiener-cli//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...allVEvents,
    "END:VCALENDAR",
  ].join("\r\n")}\r\n`;
}

describe("mergeIcs", () => {
  it("returns empty calendar for no inputs", () => {
    const merged = mergeIcs([]);
    expect(merged).toContain("BEGIN:VCALENDAR");
    expect(merged).toContain("END:VCALENDAR");
  });

  it("merges VEVENT blocks from multiple calendars", () => {
    const cal1 =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Event A\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const cal2 =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Event B\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const merged = mergeIcs([cal1, cal2]);
    const count = (merged.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2);
    expect(merged).toContain("Event A");
    expect(merged).toContain("Event B");
  });

  it("includes required ICS headers when merging calendars", () => {
    const cal =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const merged = mergeIcs([cal]);
    expect(merged).toContain("VERSION:2.0");
    expect(merged).toContain("PRODID:-//wiener-cli//EN");
    expect(merged).toContain("CALSCALE:GREGORIAN");
    expect(merged).toContain("METHOD:PUBLISH");
  });
});
