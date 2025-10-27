'use client'

import { useState, useEffect } from 'react'
import { Box, Paper, Typography, Button, IconButton } from '@mui/material'
import Link from 'next/link'

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already accepted/declined
    const consent = localStorage.getItem('turinova_cookie_consent')
    if (!consent) {
      setIsVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('turinova_cookie_consent', 'true')
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem('turinova_cookie_consent', 'false')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        p: { xs: 2, sm: 3 },
        pointerEvents: 'none'
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: '1200px',
          mx: 'auto',
          p: { xs: 2, sm: 3 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          pointerEvents: 'auto'
        }}
      >
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" sx={{ fontSize: '1.5rem' }}>
            🍪
          </Typography>
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Ez a weboldal sütiket használ</strong> a jobb felhasználói élmény érdekében.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              A folytatással elfogadja a sütik használatát.{' '}
              <Link 
                href="/cookie-policy" 
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--mui-palette-primary-main)',
                  textDecoration: 'underline',
                  fontWeight: 500
                }}
              >
                További információ
              </Link>
            </Typography>
          </Box>
        </Box>
        
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 1.5,
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleDecline}
            sx={{ 
              minWidth: { xs: '100%', sm: '120px' },
              flex: { xs: 1, sm: 'initial' }
            }}
          >
            Elutasítom
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAccept}
            sx={{ 
              minWidth: { xs: '100%', sm: '120px' },
              flex: { xs: 1, sm: 'initial' }
            }}
          >
            Elfogadom
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}

