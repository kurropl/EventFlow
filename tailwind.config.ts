import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Alboroto palette
        cream: {
          DEFAULT: '#f6f1e7',
          dark: '#e8e0d0',
        },
        gold: {
          DEFAULT: '#b08a3e',
          light: '#c9a85c',
          dark: '#8f6e2e',
        },
        burgundy: {
          DEFAULT: '#6b2737',
          light: '#8a3647',
          dark: '#4e1d28',
        },
        ink: {
          DEFAULT: '#2a2118',
          light: '#3d3228',
          soft: {
            DEFAULT: '#6b6158',
            '40': '#6b615866',
            '50': '#6b615880',
            '60': '#6b615899',
            '70': '#6b6158b3',
            '80': '#6b6158cc',
          },
        },
        paper: {
          DEFAULT: '#fbf8f1',
          dark: '#ede8da',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      scrollbar: {
        hide: {
          '&::-webkit-scrollbar': { display: 'none' },
          '&-ms-overflow-style': 'none',
          '&-scrollbar-width': 'none',
        },
      },
    },
  },
  plugins: [require('tailwind-scrollbar-hide')],
};

export default config;
