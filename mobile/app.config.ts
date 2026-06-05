import appJson from "./app.json";

export default function getExpoConfig() {
  const expo = { ...appJson.expo };
  const useEasUpdates =
    process.env.EAS_BUILD === "true" ||
    process.env.EXPO_PUBLIC_ENABLE_EAS_UPDATES === "1";

  if (!useEasUpdates) {
    const {
      updates: _updates,
      runtimeVersion: _runtimeVersion,
      owner: _owner,
      extra: originalExtra,
      ...localExpo
    } = expo;
    void _updates;
    void _runtimeVersion;
    void _owner;
    const plugins = (expo.plugins ?? []).filter((plugin) => {
      if (plugin === "expo-updates") return false;
      if (Array.isArray(plugin) && plugin[0] === "expo-updates") return false;
      return true;
    });
    const { eas: _eas, ...localExtra } = originalExtra ?? {};
    void _eas;

    return {
      expo: {
        ...localExpo,
        extra: localExtra,
        plugins,
      },
    };
  }

  return { expo };
}
