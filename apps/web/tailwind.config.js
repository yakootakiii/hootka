/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The four answer colours, each paired with a shape so the game is
        // playable without relying on colour alone.
        answer: {
          red: '#FF5A5F',
          blue: '#3D8BFF',
          yellow: '#FFC93C',
          green: '#3DDC84',
        },
        ink: {
          DEFAULT: '#241B3A',
          soft: '#5B527A',
        },
        cloud: '#F7F3FF',
        grape: {
          400: '#8C6BFF',
          500: '#6D45F5',
          600: '#5730D6',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', '"Trebuchet MS"', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        answer: ['1.6rem', { lineHeight: '1.2', fontWeight: '700' }],
        timer: ['4rem', { lineHeight: '1', fontWeight: '800' }],
      },
      boxShadow: {
        chunky: '0 6px 0 rgba(0,0,0,0.18)',
        'chunky-sm': '0 4px 0 rgba(0,0,0,0.18)',
        lift: '0 12px 30px rgba(36, 27, 58, 0.18)',
      },
      borderRadius: {
        chunky: '1.5rem',
      },
      minHeight: {
        touch: '64px',
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bobbing: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        'pop-in': 'popIn 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        bobbing: 'bobbing 2.4s ease-in-out infinite',
        wiggle: 'wiggle 600ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
