import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        surface: "hsl(var(--surface))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        melza: {
          ink: "var(--color-ink)",
          night: "var(--color-night)",
          onyx: "var(--color-onyx)",
          graphite: "var(--color-graphite)",
          silver: "var(--color-silver)",
          mist: "var(--color-mist)",
          fog: "var(--color-fog)",
          pearl: "var(--color-pearl)",
          white: "var(--color-white)",
          income: "var(--color-income)",
          expense: "var(--color-expense)",
          warning: "var(--color-warning)",
          /* aliases legados */
          bg: "var(--color-bg)",
          surface: "var(--color-surface)",
          border: "var(--color-border)",
          "border-hi": "var(--color-border-hi)",
          "silver-hi": "var(--color-silver-hi)",
          "silver-lo": "var(--color-silver-lo)",
          muted: "var(--color-muted)",
          ghost: "var(--color-ghost)",
          danger: "var(--color-danger)",
          success: "var(--color-success)",
          sidebar: "var(--color-sidebar)",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "8px",
        md: "8px",
        sm: "6px",
        xl: "12px",
        "2xl": "14px",
        "3xl": "20px",
      },
      boxShadow: {
        fab: "none",
        modal: "0 -4px 24px rgba(0,0,0,0.08)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "150ms",
        slow: "150ms",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ws-switch": {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 150ms ease",
        "ws-switch": "ws-switch 150ms ease",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
