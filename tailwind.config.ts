import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eatlee: {
          green: "#1A3C2E",
          accent: "#D4F542",
          cream: "#F7F7F2",
          mist: "#EFEFEA",
          coral: "#E05A4E",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-syne)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px rgba(26, 60, 46, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
