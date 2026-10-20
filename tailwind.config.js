/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Same brand anchor (#8f5c3c) as salon-booking-widget's tailwind.config.js, so the two
        // separately-deployed public-facing surfaces feel like the same salon, not two products.
        brand: {
          50: '#faf6f3',
          100: '#f3e9e1',
          200: '#e6d1c0',
          300: '#d6b495',
          400: '#c0906a',
          500: '#8f5c3c',
          600: '#7a4d32',
          700: '#623d28',
          800: '#4a2e1f',
          900: '#331f15',
        },
      },
    },
  },
  plugins: [],
};
