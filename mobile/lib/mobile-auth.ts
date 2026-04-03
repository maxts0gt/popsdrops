export type MobileAuthCallbackResult =
  | {
      kind: "success";
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "empty";
    };

export type SetMobileSession = (session: {
  access_token: string;
  refresh_token: string;
}) => Promise<{ error: { message: string } | null }>;

export function getMobileAuthRedirectUrl(
  createUrl: (path: string) => string,
): string {
  return createUrl("auth/callback");
}

export function parseMobileAuthCallback(
  url: string,
): MobileAuthCallbackResult {
  const parsedUrl = new URL(url);
  const queryParams = parsedUrl.searchParams;
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));

  const errorMessage =
    hashParams.get("error_description") ??
    queryParams.get("error_description") ??
    hashParams.get("error") ??
    queryParams.get("error");

  if (errorMessage) {
    return {
      kind: "error",
      message: errorMessage,
    };
  }

  const accessToken =
    hashParams.get("access_token") ?? queryParams.get("access_token");
  const refreshToken =
    hashParams.get("refresh_token") ?? queryParams.get("refresh_token");

  if (accessToken && refreshToken) {
    return {
      kind: "success",
      accessToken,
      refreshToken,
    };
  }

  return { kind: "empty" };
}

export async function completeMobileAuthSession(
  url: string,
  setSession: SetMobileSession,
): Promise<{ kind: "success" } | { kind: "error"; message: string } | { kind: "empty" }> {
  const result = parseMobileAuthCallback(url);

  if (result.kind !== "success") {
    return result;
  }

  const { error } = await setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });

  if (error) {
    return {
      kind: "error",
      message: error.message,
    };
  }

  return { kind: "success" };
}
