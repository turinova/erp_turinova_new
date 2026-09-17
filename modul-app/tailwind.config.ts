import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)'
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          disabled: 'var(--text-disabled)',
          muted: 'var(--text-muted)'
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          ink: 'var(--primary-ink)'
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          ink: 'var(--success-ink)'
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          ink: 'var(--warning-ink)'
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          ink: 'var(--danger-ink)'
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          ink: 'var(--info-ink)'
        },
        active: {
          DEFAULT: 'var(--active)',
          soft: 'var(--active-soft)',
          ink: 'var(--active-ink)'
        },
        nav: {
          blue: {
            DEFAULT: 'var(--nav-blue)',
            soft: 'var(--nav-blue-soft)',
            ink: 'var(--nav-blue-ink)'
          },
          teal: {
            DEFAULT: 'var(--nav-teal)',
            soft: 'var(--nav-teal-soft)',
            ink: 'var(--nav-teal-ink)'
          },
          cyan: {
            DEFAULT: 'var(--nav-cyan)',
            soft: 'var(--nav-cyan-soft)',
            ink: 'var(--nav-cyan-ink)'
          },
          violet: {
            DEFAULT: 'var(--nav-violet)',
            soft: 'var(--nav-violet-soft)',
            ink: 'var(--nav-violet-ink)'
          },
          amber: {
            DEFAULT: 'var(--nav-amber)',
            soft: 'var(--nav-amber-soft)',
            ink: 'var(--nav-amber-ink)'
          },
          rose: {
            DEFAULT: 'var(--nav-rose)',
            soft: 'var(--nav-rose-soft)',
            ink: 'var(--nav-rose-ink)'
          },
          emerald: {
            DEFAULT: 'var(--nav-emerald)',
            soft: 'var(--nav-emerald-soft)',
            ink: 'var(--nav-emerald-ink)'
          },
          slate: {
            DEFAULT: 'var(--nav-slate)',
            soft: 'var(--nav-slate-soft)',
            ink: 'var(--nav-slate-ink)'
          }
        }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      boxShadow: {
        elev1: 'var(--elev-1)',
        elev2: 'var(--elev-2)',
        elev3: 'var(--elev-3)'
      },
      fontSize: {
        body: [
          'var(--font-size-body)',
          { lineHeight: '1.5', fontWeight: '500' }
        ],
        h1: [
          'var(--font-size-h1)',
          { lineHeight: '1.3', fontWeight: '650' }
        ],
        h2: [
          'var(--font-size-h2)',
          { lineHeight: '1.35', fontWeight: '650' }
        ],
        h3: [
          'var(--font-size-h3)',
          { lineHeight: '1.4', fontWeight: '650' }
        ],
        label: [
          'var(--font-size-label)',
          { lineHeight: '1.4', fontWeight: '600' }
        ],
        hint: [
          'var(--font-size-hint)',
          { lineHeight: '1.45', fontWeight: '500' }
        ]
      },
      fontFamily: {
        sans: [
          'var(--font-geist-sans)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ]
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
        topbar: 'var(--topbar-height)'
      },
      minHeight: {
        control: 'var(--control-md)'
      },
      transitionTimingFunction: {
        flat: 'var(--ease-in)'
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        mid: 'var(--dur-mid)'
      },
      backgroundImage: {
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
      },
      keyframes: {
        'lf-border-beam': {
          '100%': {
            'offset-distance': '100%'
          }
        },
        'lf-image-glow': {
          '0%': {
            opacity: '0',
            'animation-timing-function': 'cubic-bezier(.74, .25, .76, 1)'
          },
          '10%': {
            opacity: '0.5',
            'animation-timing-function': 'cubic-bezier(.12, .01, .08, .99)'
          },
          '100%': {
            opacity: '0.7'
          }
        },
        'lf-flip': {
          to: {
            transform: 'rotate(360deg)'
          }
        },
        'lf-rotate': {
          to: {
            transform: 'rotate(90deg)'
          }
        }
      },
      animation: {
        'lf-border-beam':
          'lf-border-beam calc(var(--duration)*1s) infinite linear',
        'lf-image-glow': 'lf-image-glow 4s ease-out 0.6s forwards',
        'lf-flip': 'lf-flip 6s infinite steps(2, end)',
        'lf-rotate': 'lf-rotate 3s linear infinite both'
      }
    }
  },
  plugins: []
}

export default config
