'use client'

import { useState } from 'react'

import { Button, Card, CardContent, Typography, Alert, CircularProgress } from '@mui/material'

export default function SetupPermissionsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSetup = async () => {
    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/setup-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}\n\nPages created: ${data.pagesCreated}\nPermissions set: ${data.permissionsSet}`)
      } else {
        setError(`❌ Error: ${data.error}`)
      }
    } catch (err) {
      setError(`❌ Network error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Permission System Setup
          </Typography>
          
          <Typography variant="body1" paragraph>
            This will create the necessary database tables and set up permissions for your user account.
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            <strong>What this will do:</strong>
          </Typography>
          
          <ul>
            <li>Create <code>pages</code> table with default pages</li>
            <li>Create <code>user_permissions</code> table</li>
            <li>Set up admin permissions for your current user</li>
            <li>Enable the permission management system</li>
          </ul>

          {message && (
            <Alert severity="success" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
              {message}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={handleSetup}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
            fullWidth
          >
            {isLoading ? 'Setting up...' : 'Setup Permission System'}
          </Button>

          {message && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => window.location.href = '/users'}
              sx={{ mt: 2 }}
              fullWidth
            >
              Go to Users Page
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
