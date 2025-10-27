import tailwindcssLogical from 'tailwindcss-logical'
import type { Config } from 'tailwindcss'

import tailwindPlugin from './@core/tailwind/plugin'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './@core/**/*.{js,ts,jsx,tsx}',
    './@layouts/**/*.{js,ts,jsx,tsx}',
    './@menu/**/*.{js,ts,jsx,tsx}',
    './views/**/*.{js,ts,jsx,tsx}'
  ],
  corePlugins: {
    preflight: false
  },
  important: '#__next',
  plugins: [tailwindcssLogical, tailwindPlugin],
  theme: {
    extend: {}
  }
}

export default config
