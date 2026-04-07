import { describe, expect, it } from "vitest";

import {
  beginLocaleFetch,
  createLocaleFetchState,
  finishLocaleFetch,
  isLocaleFetchInFlight,
} from "./fetch-state";

describe("locale fetch state", () => {
  it("does not let an older locale fetch clear a newer one", () => {
    const initial = createLocaleFetchState();
    const korean = beginLocaleFetch(initial, "ko");
    const japanese = beginLocaleFetch(korean.state, "ja");

    expect(isLocaleFetchInFlight(japanese.state, "ja")).toBe(true);

    const afterOldCompletion = finishLocaleFetch(japanese.state, korean.requestId);
    expect(isLocaleFetchInFlight(afterOldCompletion, "ja")).toBe(true);

    const afterCurrentCompletion = finishLocaleFetch(
      afterOldCompletion,
      japanese.requestId,
    );
    expect(isLocaleFetchInFlight(afterCurrentCompletion, "ja")).toBe(false);
  });
});
