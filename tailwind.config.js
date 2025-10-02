/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'trilogis': {
          'pink': '#D11848',
          'burgundy': '#8A110E',
          'gold': '#BA8041',
          'black': '#000000',
        },
        primary: '#D11848',
        secondary: '#BA8041',
      },
    },
  },
  plugins: [],
}
