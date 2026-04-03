export const REQUIRED_RELEASE_ENV_VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type ReleaseEnvironment = Partial<Record<(typeof REQUIRED_RELEASE_ENV_VARS)[number], string>>;

export function validateReleaseEnvironment(environment: ReleaseEnvironment) {
  const missing = REQUIRED_RELEASE_ENV_VARS.filter((key) => {
    const value = environment[key];

    return typeof value !== "string" || value.trim().length === 0;
  });

  return {
    ok: missing.length === 0,
    missing,
    required: [...REQUIRED_RELEASE_ENV_VARS],
  };
}
