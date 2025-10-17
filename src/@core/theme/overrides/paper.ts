// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

const paper = (skin: Skin): Theme['components'] => {
  return {
    MuiPaper: {
      defaultProps: {
        ...(skin === 'bordered' && {
          variant: 'outlined'
        })
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    }
  }
}

export default paper
