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
        // J.Benitez brand palette — unified gold / cream / ink
        cream: {
          DEFAULT: '#faf8f5',
          dark: '#f0ead9',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#d4b85c',
          dark: '#a88a3a',
        },
        burgundy: {
          DEFAULT: '#6b2737',
          light: '#8a3647',
          dark: '#4e1d28',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          light: '#3d3228',
          // Dark luxury scale (admin panel)
          700: '#221a10',
          800: '#1a140c',
          900: '#14100a',
          950: '#0d0a06',
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
