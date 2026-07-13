import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Luxurious palette: deep charcoal-green ink with warm champagne gold.
        ink: {
          DEFAULT: "#0f1712",
          soft: "#16211b",
          muted: "#1e2c24",
        },
        champagne: {
          DEFAULT: "#d9b779",
          soft: "#e7cf9f",
          deep: "#b8934f",
        },
        cream: "#f6f1e7",
        emerald: {
          deep: "#0b3d2e",
          mid: "#12684d",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        luxe: "0 20px 60px -20px rgba(0,0,0,0.45)",
        gold: "0 8px 30px -8px rgba(217,183,121,0.35)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      backgroundImage: {
        "gold-sheen":
          "linear-gradient(135deg, #e7cf9f 0%, #d9b779 45%, #b8934f 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
