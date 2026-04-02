/* eslint-disable @typescript-eslint/no-require-imports */
const nativewindPreset = require("nativewind/preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F172A",  // slate-900 primary
          light: "#1E293B",    // slate-800
          subtle: "#F8FAFC",   // slate-50
        },
        accent: {
          teal: "#0D9488",
          amber: "#F59E0B",
        },
      },
      fontFamily: {
        inter: ["Inter"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
