import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        stone: {
          925: "#1c1917",
        },
      },
      animation: {
        "line-in": "lineIn 0.2s ease forwards",
        blink: "blink 1s step-end infinite",
        "fade-up": "fadeUp 0.6s ease forwards",
      },
    },
  },
  plugins: [],
};
export default config;
