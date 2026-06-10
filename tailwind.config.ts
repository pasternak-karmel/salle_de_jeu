/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          900: "#4c1d95",
        },
        void:    "#0F0F23",
        surface: "#0A0A18",
        card:    "#131326",
        raised:  "#1C1C3A",
        neon: {
          purple: "#7C3AED",
          cyan:   "#06B6D4",
          rose:   "#F43F5E",
          amber:  "#F59E0B",
          green:  "#10B981",
        },
      },
      fontFamily: {
        display: ["'Russo One'", "sans-serif"],
        body:    ["'Chakra Petch'", "sans-serif"],
      },
      boxShadow: {
        "glow-purple": "0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.1)",
        "glow-cyan":   "0 0 20px rgba(6,182,212,0.25), 0 0 40px rgba(6,182,212,0.08)",
        "glow-rose":   "0 0 20px rgba(244,63,94,0.25), 0 0 40px rgba(244,63,94,0.08)",
        "glow-amber":  "0 0 16px rgba(245,158,11,0.22)",
        "glow-sm":     "0 0 12px rgba(124,58,237,0.35)",
        "glow-green":  "0 0 16px rgba(16,185,129,0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
