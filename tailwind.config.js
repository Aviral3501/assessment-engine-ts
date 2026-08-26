/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F1417",
        surface: "#161C21",
        surface2: "#1C242B",
        border: "#29333B",
        borderSoft: "#202A31",
        text: "#E7EDF1",
        textMuted: "#8FA0AB",
        textDim: "#5C6C77",
        accent: "#4FA3E3",
        accentDim: "#2E5D7D",
        correct: "#4FB07C",
        correctBg: "#16261F",
        incorrect: "#E2685A",
        incorrectBg: "#2A1917",
        partial: "#E0A63E",
        partialBg: "#2A2216",
        due: "#C97FE0",
        mastered: "#8B6FE0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
