import { describe, expect, test } from "bun:test";
import { formatDueDate } from "../../src/lib/format/date.js";

function isoFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

describe("formatDueDate", () => {
  test("null or undefined returns dim dash", () => {
    expect(formatDueDate(null)).toContain("—");
    expect(formatDueDate(undefined)).toContain("—");
  });

  test("overdue by more than 24h shows atrasada Xd", () => {
    const twoDaysAgo = isoFromNow(-2 * 24 * 3600 * 1000);
    const result = formatDueDate(twoDaysAgo);
    expect(result).toContain("atrasada");
    expect(result).toContain("2d");
  });

  test("overdue less than 24h shows vencida hace Xh", () => {
    const twoHoursAgo = isoFromNow(-2 * 3600 * 1000);
    const result = formatDueDate(twoHoursAgo);
    expect(result).toContain("vencida hace");
    expect(result).toContain("h");
  });

  test("due in less than 1h shows en Xmin", () => {
    const thirtyMin = isoFromNow(30 * 60 * 1000);
    const result = formatDueDate(thirtyMin);
    expect(result).toContain("en");
    expect(result).toContain("min");
  });

  test("due in 3h shows en Xh", () => {
    const threeHours = isoFromNow(3 * 3600 * 1000);
    const result = formatDueDate(threeHours);
    expect(result).toContain("en");
    expect(result).toContain("h");
  });

  test("due today shows hoy or mañana (depending on clock)", () => {
    const in8h = isoFromNow(8 * 3600 * 1000);
    const result = formatDueDate(in8h);
    expect(result).toMatch(/hoy|mañana|lun|mar|mié|jue|vie|sáb|dom/);
  });

  test("due in 2 days shows weekday + time", () => {
    const in2days = isoFromNow(2 * 24 * 3600 * 1000);
    const result = formatDueDate(in2days);
    expect(result).toBeTruthy();
    expect(result).not.toContain("—");
  });

  test("due in 2 weeks shows date + time (dimmed)", () => {
    const in2weeks = isoFromNow(14 * 24 * 3600 * 1000);
    const result = formatDueDate(in2weeks);
    expect(result).toBeTruthy();
    expect(result).not.toContain("—");
  });

  test("invalid date string returns dim dash", () => {
    const result = formatDueDate("not-a-date");
    expect(result).toContain("—");
  });

  test("ANSI codes do not contain a.m./p.m. Spanish format", () => {
    const in8h = isoFromNow(8 * 3600 * 1000);
    const result = formatDueDate(in8h);
    expect(result).not.toContain("a. m.");
    expect(result).not.toContain("p. m.");
  });
});
