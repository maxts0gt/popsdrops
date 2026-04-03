export function isAppShellReady(input: {
  fontsLoaded: boolean;
  fontFallbackElapsed: boolean;
  themeReady: boolean;
  localeReady: boolean;
}) {
  if (!input.themeReady || !input.localeReady) {
    return false;
  }

  return input.fontsLoaded || input.fontFallbackElapsed;
}
