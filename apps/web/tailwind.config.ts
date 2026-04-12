import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#070B14',
        surface: '#111827',
        'surface-2': '#1A2233',
        border: '#1E2A3A',
        accent: '#00B4D8',
        gold: '#C98B1A',
        success: '#0EA47A',
        danger: '#DC2626',
      },
    },
  },
  plugins: [],
};

export default config;
