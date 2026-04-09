/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          card: 'var(--bg-card)',
          input: 'var(--bg-input)',
          hover: 'var(--bg-hover)',
        },
        border: {
          DEFAULT: 'var(--border-primary)',
          input: 'var(--border-input)',
          focus: 'var(--border-focus)',
          dashed: 'var(--border-dashed)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
          link: 'var(--text-link)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          'primary-hover': 'var(--accent-primary-hover)',
          'primary-light': 'var(--accent-primary-light)',
          success: 'var(--accent-success)',
          'success-light': 'var(--accent-success-light)',
          warning: 'var(--accent-warning)',
          'warning-light': 'var(--accent-warning-light)',
          danger: 'var(--accent-danger)',
          'danger-light': 'var(--accent-danger-light)',
          info: 'var(--accent-info)',
          'info-light': 'var(--accent-info-light)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          'active-bg': 'var(--sidebar-active-bg)',
          'active-border': 'var(--sidebar-active-border)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [],
};
