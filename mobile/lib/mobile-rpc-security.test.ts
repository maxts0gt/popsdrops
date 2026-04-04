import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("accept_counter_offer migration", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "..", "..", "supabase", "migrations", "022_mobile_rpc.sql"),
    "utf8",
  );

  it("uses a null-safe auth check inside the SECURITY DEFINER function", () => {
    expect(sql).toContain("IF v_app.creator_id IS DISTINCT FROM auth.uid() THEN");
  });

  it("revokes PUBLIC execute before granting access to authenticated callers", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.accept_counter_offer(UUID) FROM PUBLIC;",
    );
  });
});
