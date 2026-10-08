import type { Config } from "tailwindcss";

/** Tokens do design system CLEARFINGER — cores vêm de CSS vars (primária/marinho/fundo editáveis no admin). */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: token("primary"),
        navy: token("navy"),
        ink: token("ink"),
        bg: token("bg"),
        mist: token("mist"),
        surface: token("surface"),
        muted: token("muted"),
        line: token("line"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "1.25rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(11 37 69 / 0.05), 0 6px 20px -8px rgb(11 37 69 / 0.12)",
        lift: "0 2px 6px rgb(11 37 69 / 0.06), 0 20px 44px -16px rgb(11 37 69 / 0.28)",
      },
      maxWidth: { page: "72rem" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        slideup: { from: { transform: "translateY(110%)" }, to: { transform: "none" } },
      },
      animation: {
        rise: "rise .45s cubic-bezier(.2,.7,.2,1) both",
        slideup: "slideup .3s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
