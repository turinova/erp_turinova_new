import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react'

import { Alert, Box, Button, Typography } from '@mui/material'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box p={3}>
          <Alert severity="error">
            <Typography variant="h6">Something went wrong</Typography>
            <Typography variant="body2">
              The optimization page encountered an error. Please refresh the page.
            </Typography>
            <Button 
              onClick={() => window.location.reload()} 
              variant="contained" 
              sx={{ mt: 2 }}
            >
              Refresh Page
            </Button>
          </Alert>
        </Box>
      )
    }

    return this.props.children
  }
}
