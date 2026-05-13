/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Safelist grid column classes for dynamic sections
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-6',
    'grid-cols-8',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'md:grid-cols-4',
    'md:grid-cols-6',
    'md:grid-cols-8',
    'lg:grid-cols-2',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'lg:grid-cols-6',
    'lg:grid-cols-8',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color)',
          dark: 'var(--primary-dark)',
        },
        cream: '#FFF7E0',
        seller: {
          50: 'var(--primary-alpha-10)',
          100: 'var(--primary-alpha-20)',
          200: 'var(--primary-alpha-30)',
          300: 'var(--primary-alpha-40)',
          400: 'var(--primary-alpha-50)',
          500: 'var(--primary-color)', // Primary dynamic color
          600: 'var(--primary-dark)', // Secondary/Hover dynamic color
          700: 'var(--primary-darker)',
          800: 'var(--primary-darker)',
          900: 'var(--primary-darker)',
        },
      },
    },
  },
  plugins: [],
}

