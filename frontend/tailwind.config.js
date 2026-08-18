/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f1e8",
        surface: "#fffdf8",
        alt: "#efe6d8",
        ink: "#26302b",
        muted: "#64706a",
        forest: "#285447",
        "forest-dark": "#193b33",
        terracotta: "#b85c3e",
        ochre: "#c7953d",
        sage: "#afc4ae",
        border: "#d8ccba",
      },
      fontFamily: {
        serif: [
          "'DM Serif Display'",
          "Georgia",
          "serif",
        ],
        sans: [
          "'IBM Plex Sans'",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "'IBM Plex Mono'",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "0 4px 20px rgba(38, 48, 43, 0.06)",
        card: "0 2px 12px rgba(38, 48, 43, 0.05)",
      },
    },
  },
  plugins: [],
};