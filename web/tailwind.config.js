/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fonds
        ink: '#0a0e17',
        surface: {
          DEFAULT: '#101729',
          raised: '#16203a',
        },
        // Bordures
        line: {
          DEFAULT: 'rgba(148, 163, 184, 0.10)',
          strong: 'rgba(148, 163, 184, 0.22)',
        },
        // Accent de marque
        accent: {
          DEFAULT: '#22d3ee',
          deep: '#0891b2',
        },
        brand: {
          violet: '#8b5cf6',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.35), 0 10px 30px -16px rgba(0, 0, 0, 0.55)',
        'card-hover': '0 1px 2px rgba(0, 0, 0, 0.4), 0 18px 40px -18px rgba(0, 0, 0, 0.7)',
        glow: '0 0 0 1px rgba(34, 211, 238, 0.25), 0 8px 30px -10px rgba(34, 211, 238, 0.25)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        rise: 'rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
