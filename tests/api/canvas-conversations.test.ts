import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

function fixtureConversations() {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, "canvas-conversations.json"), "utf-8"),
  ) as Array<Record<string, unknown>>;
}

describe("canvas conversations fixture shape", () => {
  it("has expected fields", () => {
    const convs = fixtureConversations();
    expect(convs).toBeArray();
    expect(convs.length).toBe(2);

    const first = convs[0] as Record<string, unknown>;
    expect(first.id).toBeNumber();
    expect(first.subject).toBeString();
    expect(first.workflow_state).toBeString();
    expect(first.message_count).toBeNumber();
    expect(first.participants).toBeArray();
  });

  it("unread conversation has workflow_state=unread", () => {
    const convs = fixtureConversations();
    const unread = convs.find((c) => c.workflow_state === "unread");
    expect(unread).toBeDefined();
  });

  it("read conversation has workflow_state=read", () => {
    const convs = fixtureConversations();
    const read = convs.find((c) => c.workflow_state === "read");
    expect(read).toBeDefined();
  });

  it("conversation has messages array", () => {
    const convs = fixtureConversations();
    const first = convs[0] as Record<string, unknown>;
    expect(first.messages).toBeArray();
  });

  it("messages have required fields", () => {
    const convs = fixtureConversations();
    const first = convs[0] as Record<string, unknown>;
    const messages = first.messages as Array<Record<string, unknown>>;
    for (const msg of messages) {
      expect(msg.id).toBeNumber();
      expect(msg.body).toBeString();
      expect(msg.author_id).toBeNumber();
      expect(msg.created_at).toBeString();
    }
  });
});
