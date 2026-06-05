import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlatformChip, PlatformIcon } from "./platform-icons";

describe("platform icon fallback", () => {
  it("renders custom campaign platforms without crashing", () => {
    const Icon = PlatformIcon.xiaohongshu;

    expect(typeof Icon).toBe("function");
    expect(renderToStaticMarkup(<Icon />)).toContain("<svg");
    expect(renderToStaticMarkup(<PlatformChip platform="xiaohongshu" />)).toContain(
      "Xiaohongshu",
    );
  });
});
