import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#070A12",
          raised: "#0E1320",
          sunken: "#050811",
          glass: "rgba(20, 27, 45, 0.6)",
        },
        brand: {
          crimson: "#DC2547",
          teal: "#0DB4C9",
          violet: "#7B5FFF",
          mint: "#1FCFA0",
          amber: "#F5A623",
        },
        ink: {
          high: "#F4F6FB",
          mid: "#A8B2C8",
          low: "#5B677D",
          faint: "#2C3346",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono],
        display: ["Instrument Serif", "serif"],
      },
      backgroundImage: {
        "grid-dot": "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-4": "4px 4px",
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "orb-glow": "orb-glow 3s ease-in-out infinite",
        "flow-particles": "flow-particles 2s linear infinite",
      },
      keyframes: {
        "orb-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(220, 37, 71, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(220, 37, 71, 0.8)" },
        },
        "flow-particles": {
          "0%": { transform: "translate(0, 0) opacity(1)" },
          "100%": { transform: "translate(100px, 100px) opacity(0)" },
        },
      },
      boxShadow: {
        glass:
          "0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px rgba(0,0,0,0.6)",
        "glass-lg":
          "0 0 0 1px rgba(255,255,255,0.08), 0 30px 100px -30px rgba(0,0,0,0.8)",
      },
      backdropBlur: {
        glass: "blur(40px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
