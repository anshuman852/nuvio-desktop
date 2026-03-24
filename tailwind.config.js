/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nuvio: {
          bg:       "#0a0a0f",
          surface:  "#12121a",
          card:     "#1a1a26",
          border:   "#2a2a3d",
          accent:   "#6c63ff",
          "accent-hover": "#8b85ff",
          text:     "#e8e8f0",
          muted:    "#6b6b80",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
