import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        gold: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        glass: {
          white: "rgba(255,255,255,0.72)",
          light: "rgba(255,255,255,0.50)",
          border: "rgba(255,255,255,0.60)",
          dark:  "rgba(255,255,255,0.08)",
        },
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(at 20% 20%, #e0e7ff 0%, transparent 50%), radial-gradient(at 80% 0%, #fef3c7 0%, transparent 50%), radial-gradient(at 80% 80%, #e0e7ff 0%, transparent 50%)",
        "mesh-card":
          "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)",
      },
      boxShadow: {
        glass:   "0 8px 32px rgba(99,102,241,0.10), 0 1px 0 rgba(255,255,255,0.80) inset",
        "glass-lg": "0 24px 64px rgba(99,102,241,0.15), 0 1px 0 rgba(255,255,255,0.80) inset",
        "card-3d": "0 20px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.06)",
        "card-hover": "0 32px 80px rgba(99,102,241,0.20), 0 4px 20px rgba(0,0,0,0.08)",
        "badge": "0 2px 8px rgba(99,102,241,0.20)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        "slide-up": "slideUp 0.5s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "spin-slow": "spin 20s linear infinite",
        "counter": "counter 1s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-12px)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "0.7" },
          "50%":     { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      perspective: {
        "1000": "1000px",
        "2000": "2000px",
      },
    },
  },
  plugins: [],
};
export default config;
