/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: {
          900: '#050A18',
          800: '#0a1228',
          700: '#0e1a3c',
          600: '#122550',
        },
        neon: {
          blue: '#00D4FF',
          cyan: '#22d3ee',
          violet: '#a78bfa',
          pink: '#f472b6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(0,212,255,0.35), 0 0 40px rgba(0,212,255,0.2)',
        'neon-strong': '0 0 30px rgba(0,212,255,0.55), 0 0 60px rgba(0,212,255,0.35)',
        'neon-violet': '0 0 25px rgba(167,139,250,0.45)',
        'neon-pink': '0 0 25px rgba(244,114,182,0.4)',
        'glow-blue': '0 8px 32px rgba(0,212,255,0.25), 0 0 16px rgba(0,212,255,0.15)',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.5s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};
