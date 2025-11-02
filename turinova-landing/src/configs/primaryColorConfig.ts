export type PrimaryColorConfig = {
  name?: string
  light?: string
  main: string
  dark?: string
}

// Primary color config object - Notion-inspired color scheme (matching main app)
const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',
    light: '#4A4A4A',
    main: '#000000',
    dark: '#000000'
  },
  {
    name: 'primary-2',
    light: '#4DAB9A',
    main: '#0F7B6C',
    dark: '#0A5A4F'
  },
  {
    name: 'primary-3',
    light: '#FFA344',
    main: '#D9730D',
    dark: '#B85C0A'
  },
  {
    name: 'primary-4',
    light: '#FF7369',
    main: '#E03E3E',
    dark: '#B83232'
  },
  {
    name: 'primary-5',
    light: '#529CCA',
    main: '#0B6E99',
    dark: '#085A7A'
  }
]

export default primaryColorConfig
