import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const roomScreenSource = readFileSync(
  join(currentDir, "../app/campaign-room/[id].tsx"),
  "utf8",
);
const roomStateSource = readFileSync(
  join(currentDir, "./campaign-room-state.ts"),
  "utf8",
);
const designSource = readFileSync(join(currentDir, "../../DESIGN.md"), "utf8");

describe("mobile creator room product scope", () => {
  it("keeps creator mobile rooms on work handoff instead of chat", () => {
    expect(designSource).toContain(
      "Creator campaign rooms should show handoff work as one compact sequence.",
    );
    expect(roomStateSource).toContain(
      'export type CampaignRoomTab = "brief" | "tasks" | "submit"',
    );
    expect(roomScreenSource).toContain("type CampaignRoomTab");
    expect(roomScreenSource).not.toContain('"chat"');
    expect(roomScreenSource).not.toContain("ChatTab");
    expect(roomScreenSource).not.toContain("campaign-chat");
    expect(roomScreenSource).not.toContain("sendCampaignMessage");
  });
});
