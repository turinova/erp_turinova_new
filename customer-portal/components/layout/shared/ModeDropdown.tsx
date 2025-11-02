'use client'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import { useColorScheme } from '@mui/material/styles'

const ModeDropdown = () => {
  // Hooks
  const { mode, setMode } = useColorScheme()

  const handleToggle = () => {
    setMode(mode === 'light' ? 'dark' : 'light')
  }

  return (
    <IconButton onClick={handleToggle} color='inherit'>
      <i className={mode === 'light' ? 'ri-moon-line' : 'ri-sun-line'} />
    </IconButton>
  )
}

export default ModeDropdown

