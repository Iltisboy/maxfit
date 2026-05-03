/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0c10',
        sf: '#12141c',
        card: '#181a28',
        brd: '#252840',
        acc: '#00d4aa',
        'acc-h': '#00f5c8',
        'acc-d': '#009e80',
        'acc-g': 'rgba(0,212,170,0.15)',
        dim: '#9da1bd',
        mut: '#5e6280',
        't-primary': '#e4e6f0',
        gold: '#fbbf24',
        cred: '#f87171',
        cblue: '#60a5fa',
        lime: '#a3e635',
        cyan: '#22d3ee',
        corange: '#fb923c',
        cgreen: '#4ade80',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
