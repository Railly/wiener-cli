import { describe, expect, it } from "bun:test";
import { relativeDate } from "../../src/lib/time.js";

describe("relativeDate", () => {
  it("returns '—' for null", () => {
    expect(relativeDate(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(relativeDate(undefined)).toBe("—");
  });

  it("returns 'ahora' for very recent", () => {
    const now = new Date().toISOString();
    expect(relativeDate(now)).toBe("ahora");
  });

  it("returns relative hours for recent dates", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(relativeDate(twoHoursAgo)).toBe("hace 2h");
  });

  it("returns relative days", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativeDate(threeDaysAgo)).toBe("hace 3d");
  });

  it("returns 'ayer' for ~24h ago", () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(relativeDate(yesterday)).toBe("ayer");
  });

  it("returns weeks for older dates", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativeDate(twoWeeksAgo)).toBe("hace 2sem");
  });

  it("returns '—' for invalid date string", () => {
    expect(relativeDate("not-a-date")).toBe("—");
  });
});

describe("inbox conversation shape", () => {
  const fixture = [
    {
      id: 8001,
      subject: "Consulta sobre Práctica 2",
      workflow_state: "unread",
      last_message_at: "2026-04-25T14:00:00Z",
      message_count: 3,
      participants: [
        { id: 9001, name: "Alumno Test" },
        { id: 1001, name: "Prof. García, Luis" },
      ],
      context_name: "LABORATORIO Y DIAGNÓSTICO II",
      messages: [
        { id: 20001, created_at: "2026-04-24T10:00:00Z", body: "Consulta...", author_id: 9001 },
        { id: 20002, created_at: "2026-04-25T14:00:00Z", body: "Respuesta.", author_id: 1001 },
      ],
    },
    {
      id: 8002,
      subject: "Cambio de aula",
      workflow_state: "read",
      last_message_at: "2026-04-23T09:00:00Z",
      message_count: 1,
      participants: [{ id: 1002, name: "Prof. Pérez, Ana" }],
      context_name: "CIENCIA Y DESCUBRIMIENTO",
      messages: [
        { id: 20003, created_at: "2026-04-23T09:00:00Z", body: "Aula 305.", author_id: 1002 },
      ],
    },
  ];

  it("correctly identifies unread conversations", () => {
    const unread = fixture.filter((c) => c.workflow_state === "unread");
    expect(unread.length).toBe(1);
    expect(unread[0]?.subject).toBe("Consulta sobre Práctica 2");
  });

  it("builds participant map correctly", () => {
    const conv = fixture[0];
    if (!conv) throw new Error("fixture missing");
    const participantMap = new Map((conv.participants ?? []).map((p) => [p.id, p.name]));
    expect(participantMap.get(9001)).toBe("Alumno Test");
    expect(participantMap.get(1001)).toBe("Prof. García, Luis");
  });

  it("resolves message authors", () => {
    const conv = fixture[0];
    if (!conv) throw new Error("fixture missing");
    const participantMap = new Map((conv.participants ?? []).map((p) => [p.id, p.name]));
    const msgs = (conv.messages ?? []).map((m) => ({
      ...m,
      author: participantMap.get(m.author_id) ?? `User ${m.author_id}`,
    }));
    expect(msgs[0]?.author).toBe("Alumno Test");
    expect(msgs[1]?.author).toBe("Prof. García, Luis");
  });
});
