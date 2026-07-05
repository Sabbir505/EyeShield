/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        void: '#08080C',
        'ion-purple': '#7C6FF7',
        'plasma': '#00D4AA',
        'glass-fill': 'rgba(255,255,255,0.08)',
        'glass-border': 'rgba(255,255,255,0.18)',
        'text-primary': '#F5F5F7',
        'text-muted': '#9B98B5',
      },
      fontFamily: {
        grotesk: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        glass: '24px',
      },
      backdropBlur: {
        glass: '24px',
      },
      animation: {
        'blob-drift': 'blobDrift 25s ease-in-out infinite',
        'specular': 'specular 8s ease-in-out infinite',
      },
      keyframes: {
        blobDrift: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(40px,-30px) scale(1.1)' },
          '66%': { transform: 'translate(-30px,40px) scale(0.95)' },
        },
        specular: {
          '0%, 100%': { opacity: '0.3', transform: 'translateX(-30%)' },
          '50%': { opacity: '0.7', transform: 'translateX(30%)' },
        },
      },
    },
  },
  plugins: [],
};
