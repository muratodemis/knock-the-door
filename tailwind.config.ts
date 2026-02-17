import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "knock": "knock 0.5s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        "door-open": "door-open 0.6s ease-out forwards",
      },
      keyframes: {
        knock: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-3deg)" },
          "75%": { transform: "rotate(3deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.5)", opacity: "1" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "door-open": {
          "0%": { transform: "perspective(600px) rotateY(0deg)" },
          "100%": { transform: "perspective(600px) rotateY(-45deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
