import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#011E02",
          secondary: "#011E02",
        },
        accent: {
          gold: "#0a4f22",
          "gold-hover": "#011E02",
        },
        ivory: "#F8F6F2",
        charcoal: "#1E1E1E",
      },
      fontFamily: {
        title: ["Poppins", "sans-serif"],
        subtitle: ["Poppins", "sans-serif"],
        body: ["Poppins", "sans-serif"],
        action: ["Poppins", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      }
    },
  },
  plugins: [],
};

export default config;
