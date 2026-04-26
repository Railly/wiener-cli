import { describe, expect, test } from "bun:test";
import {
  bloqueContainsNow,
  minutesUntilBloque,
  sortBloquesByTime,
} from "../../src/lib/horario-time.ts";
import type { HorarioBloque } from "../../src/types/intranet.ts";

function makeBloque(time_start: string, time_end: string): HorarioBloque {
  return {
    time_start,
    time_end,
    course_code: "TEST",
    course_name: "Test Course",
    section: "A",
    type: "",
    room: "",
    building: "",
    attribute: "",
    teacher: "",
  };
}

describe("bloqueContainsNow", () => {
  test("returns true when now is within bloque", () => {
    const b = makeBloque("07:00", "10:00");
    expect(bloqueContainsNow(b, 7 * 60 + 30)).toBe(true); // 7:30
  });

  test("returns true at exact start time", () => {
    const b = makeBloque("07:00", "10:00");
    expect(bloqueContainsNow(b, 7 * 60)).toBe(true);
  });

  test("returns true at exact end time", () => {
    const b = makeBloque("07:00", "10:00");
    expect(bloqueContainsNow(b, 10 * 60)).toBe(true);
  });

  test("returns false before bloque", () => {
    const b = makeBloque("07:00", "10:00");
    expect(bloqueContainsNow(b, 6 * 60)).toBe(false);
  });

  test("returns false after bloque", () => {
    const b = makeBloque("07:00", "10:00");
    expect(bloqueContainsNow(b, 11 * 60)).toBe(false);
  });
});

describe("minutesUntilBloque", () => {
  test("returns positive minutes when bloque is in future", () => {
    const b = makeBloque("11:30", "14:00");
    const nowMinutes = 9 * 60; // 09:00
    expect(minutesUntilBloque(b, nowMinutes)).toBe(2.5 * 60); // 150 min
  });

  test("returns negative when bloque is in past", () => {
    const b = makeBloque("07:00", "10:00");
    const nowMinutes = 12 * 60; // 12:00
    expect(minutesUntilBloque(b, nowMinutes)).toBe(-5 * 60); // -300 min
  });
});

describe("sortBloquesByTime", () => {
  test("sorts by time_start ascending", () => {
    const bloques = [
      makeBloque("15:00", "18:00"),
      makeBloque("07:00", "10:00"),
      makeBloque("11:30", "14:00"),
    ];
    const sorted = sortBloquesByTime(bloques);
    expect(sorted[0]?.time_start).toBe("07:00");
    expect(sorted[1]?.time_start).toBe("11:30");
    expect(sorted[2]?.time_start).toBe("15:00");
  });

  test("does not mutate original array", () => {
    const bloques = [makeBloque("15:00", "18:00"), makeBloque("07:00", "10:00")];
    sortBloquesByTime(bloques);
    expect(bloques[0]?.time_start).toBe("15:00"); // original unchanged
  });
});
