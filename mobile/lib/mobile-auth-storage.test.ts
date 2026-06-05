import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mobileSupabaseSource = readFileSync(
  path.resolve(__dirname, "supabase.ts"),
  "utf8",
);

describe("mobile Supabase auth storage", () => {
  it("stores Supabase sessions in SecureStore instead of AsyncStorage", () => {
    expect(mobileSupabaseSource).toContain("expo-secure-store");
    expect(mobileSupabaseSource).toContain("mobileSessionStorage");
    expect(mobileSupabaseSource).toContain("SecureStore.getItemAsync");
    expect(mobileSupabaseSource).toContain("SecureStore.setItemAsync");
    expect(mobileSupabaseSource).toContain("SecureStore.deleteItemAsync");
    expect(mobileSupabaseSource).not.toContain(
      "@react-native-async-storage/async-storage",
    );
  });

  it("uses localStorage on Expo web so browser smoke can load the app", () => {
    expect(mobileSupabaseSource).toContain('Platform.OS === "web"');
    expect(mobileSupabaseSource).toContain("window.localStorage.getItem");
    expect(mobileSupabaseSource).toContain("window.localStorage.setItem");
    expect(mobileSupabaseSource).toContain("window.localStorage.removeItem");
  });
});
