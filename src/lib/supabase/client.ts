import { createBrowserClient } from "@supabase/ssr";

function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;
let browserUserRequest: Promise<
  Awaited<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["auth"]["getUser"]>>
> | null = null;

export function createClient() {
  browserClient ??= createBrowserSupabaseClient();

  return browserClient;
}

export function getBrowserUser() {
  const client = createClient();

  browserUserRequest ??= client.auth.getUser().finally(() => {
    browserUserRequest = null;
  });

  return browserUserRequest;
}
