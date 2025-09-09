// React Imports
import { useEffect } from 'react'

// MUI Imports
import { useColorScheme } from '@mui/material/styles'

const ModeChanger = () => {
  // Hooks
  const { setMode } = useColorScheme()

  useEffect(() => {
    // Always set to light mode for Turinova ERP
    setMode('light')
  }, [setMode])

  return null
}

export default ModeChanger
