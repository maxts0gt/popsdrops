import { describe, expect, it } from "vitest";

import { getSourceStrings } from "./strings";

describe("English source string contracts", () => {
  it("keeps request-invite verification errors scoped to real copy", () => {
    const requestInvite = getSourceStrings("marketing.requestInvite");

    expect(requestInvite["form.verification"]).toBe(
      "Please complete verification to continue.",
    );
  });
});
