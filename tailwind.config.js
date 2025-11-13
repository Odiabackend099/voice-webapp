/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        'purple-900': '#581c87',
        'purple-800': '#6b21a8',
        'purple-700': '#7e22ce',
        'purple-600': '#9333ea',
        'purple-500': '#a855f7',
        'purple-400': '#c084fc',
        'purple-300': '#d8b4fe',
        'purple-200': '#e9d5ff',
        'purple-100': '#f3e8ff',
      }
    },
  },
  plugins: [],
}