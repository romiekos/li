import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        mist: 'rgb(var(--color-mist) / <alpha-value>)',
        sub: 'rgb(var(--color-sub) / <alpha-value>)',
        dim: 'rgb(var(--color-dim) / <alpha-value>)',
        acid: 'rgb(var(--color-acid) / <alpha-value>)',
        ember: 'rgb(var(--color-ember) / <alpha-value>)',
        cyan: 'rgb(var(--color-cyan) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        pixel: '0 0 0 1px rgb(var(--color-mist) / 0.12), 0 18px 60px rgba(0,0,0,0.52)'
      }
    }
  },
  plugins: []
} satisfies Config;
