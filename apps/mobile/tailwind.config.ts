import type { Config } from 'tailwindcss';

export default {
  content: [
    './app.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        dark: '#000000',
        surface: '#0f0f0f',
        border: '#1f2937',
      },
    },
  },
  plugins: [],
} satisfies Config;
