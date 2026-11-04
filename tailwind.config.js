/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Refined Institutional Navy-Slate (replaces neon electric blue)
        brand: {
          50: '#f4f6f8',
          100: '#e5eaef',
          200: '#cbd5e0',
          300: '#a3b4c6',
          400: '#7189a1',
          500: '#4a647d',
          600: '#2c445a',
          700: '#223547',
          800: '#1a2836',
          900: '#131d27',
          950: '#0c131a',
        },
        // Muted Academic Slate-Blue (replaces neon purple-indigo)
        indigo: {
          50: '#f3f5f8',
          100: '#e3e8ef',
          200: '#c8d2df',
          300: '#9fb0c7',
          400: '#7088a8',
          500: '#4d678a',
          600: '#364f6b',
          700: '#2b3f56',
          800: '#223244',
          900: '#1b2735',
          950: '#111922',
        },
        // Natural Sage / Forest Green (replaces neon emerald)
        emerald: {
          50: '#f2f7f4',
          100: '#dfece4',
          200: '#bfd9ca',
          300: '#92bda5',
          400: '#619b7c',
          500: '#3f7d5d',
          600: '#2f6348',
          700: '#264f3b',
          800: '#1f4030',
          900: '#193427',
          950: '#0e1d16',
        }
      }
    },
  },
  plugins: [],
}
