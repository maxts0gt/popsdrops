export type MobileAuthCallbackResult =
  | {
      kind: "success";
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: "code";
      code: string;
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

export type ExchangeMobileAuthCode = (
  code: string,
) => Promise<{ error: { message: string } | null }>;

export type MobileAuthRouteParams = Record<
  string,
  string | string[] | undefined
>;

const MOBILE_AUTH_CALLBACK_PARAM_KEYS = [
  "access_token",
  "refresh_token",
  "code",
  "error",
  "error_description",
] as const;

function getFirstRouteParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getMobileAuthRedirectUrl(
  createUrl: (path: string) => string,
): string {
  return createUrl("auth/callback");
}

export function buildMobileAuthCallbackUrlFromParams(
  params: MobileAuthRouteParams,
): string | null {
  const query = new URLSearchParams();

  for (const key of MOBILE_AUTH_CALLBACK_PARAM_KEYS) {
    const value = getFirstRouteParamValue(params[key]);
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  if (!queryString) {
    return null;
  }

  return `popsdrops://auth/callback?${queryString}`;
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

  const code = hashParams.get("code") ?? queryParams.get("code");

  if (code) {
    return {
      kind: "code",
      code,
    };
  }

  return { kind: "empty" };
}

export async function completeMobileAuthSession(
  url: string,
  setSession: SetMobileSession,
  exchangeCodeForSession?: ExchangeMobileAuthCode,
): Promise<{ kind: "success" } | { kind: "error"; message: string } | { kind: "empty" }> {
  const result = parseMobileAuthCallback(url);

  if (result.kind === "code") {
    if (!exchangeCodeForSession) {
      return { kind: "empty" };
    }

    const { error } = await exchangeCodeForSession(result.code);

    if (error) {
      return {
        kind: "error",
        message: error.message,
      };
    }

    return { kind: "success" };
  }

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
