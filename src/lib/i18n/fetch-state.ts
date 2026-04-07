export type LocaleFetchState = {
  activeLocale: string | null;
  activeRequestId: number;
};

export function createLocaleFetchState(): LocaleFetchState {
  return {
    activeLocale: null,
    activeRequestId: 0,
  };
}

export function beginLocaleFetch(
  state: LocaleFetchState,
  locale: string,
): {
  state: LocaleFetchState;
  requestId: number;
} {
  const requestId = state.activeRequestId + 1;

  return {
    requestId,
    state: {
      activeLocale: locale,
      activeRequestId: requestId,
    },
  };
}

export function finishLocaleFetch(
  state: LocaleFetchState,
  requestId: number,
): LocaleFetchState {
  if (state.activeRequestId !== requestId) {
    return state;
  }

  return {
    ...state,
    activeLocale: null,
  };
}

export function isLocaleFetchInFlight(
  state: LocaleFetchState,
  locale: string,
): boolean {
  return state.activeLocale === locale;
}
