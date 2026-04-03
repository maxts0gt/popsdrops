import { describe, expect, it } from "vitest";
import { decideCreatorHomeState } from "./creator-home-state";

describe("decideCreatorHomeState", () => {
  it("shows setup mode for creators without an approved account yet", () => {
    expect(decideCreatorHomeState(null)).toBe("setup");
    expect(decideCreatorHomeState("pending")).toBe("setup");
  });

  it("shows workspace mode for approved creators", () => {
    expect(decideCreatorHomeState("approved")).toBe("workspace");
  });

  it("shows blocked mode for unavailable accounts", () => {
    expect(decideCreatorHomeState("rejected")).toBe("blocked");
    expect(decideCreatorHomeState("suspended")).toBe("blocked");
  });
});
