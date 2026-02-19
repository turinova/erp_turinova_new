'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  Alert,
  Divider
} from '@mui/material'
import { CheckCircle, Error, Warning, Refresh } from '@mui/icons-material'

interface TestResult {
  status: 'success' | 'error' | 'warning'
  message: string
  [key: string]: any
}

interface TestResponse {
  timestamp: string
  tests: {
    anthropic?: TestResult
    openai?: TestResult
    supabase_db?: TestResult
    supabase_storage?: TestResult
    database_tables?: TestResult
  }
  summary: {
    total: number
    success: number
    errors: number
    warnings: number
    allPassed: boolean
  }
}

export default function TestAIPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTests = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/test-ai-system')
      const data = await response.json()

      if (!response.ok) {
        setError('Some tests failed. Check the results below.')
      }

      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />
      case 'error':
        return <Error color="error" />
      case 'warning':
        return <Warning color="warning" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        AI System Test
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test all AI system components: Anthropic API, OpenAI API, Supabase Database, and Storage.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
          onClick={runTests}
          disabled={loading}
        >
          {loading ? 'Running Tests...' : 'Run Tests'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {results && (
        <>
          {/* Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Test Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={`Total: ${results.summary.total}`}
                  color="default"
                />
                <Chip
                  label={`Success: ${results.summary.success}`}
                  color="success"
                />
                <Chip
                  label={`Errors: ${results.summary.errors}`}
                  color="error"
                />
                <Chip
                  label={`Warnings: ${results.summary.warnings}`}
                  color="warning"
                />
              </Box>
              <Alert
                severity={results.summary.allPassed ? 'success' : 'warning'}
              >
                {results.summary.allPassed
                  ? 'All tests passed! System is ready.'
                  : 'Some tests failed or have warnings. Please check the details below.'}
              </Alert>
            </CardContent>
          </Card>

          {/* Individual Test Results */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Test Results
              </Typography>

              {Object.entries(results.tests).map(([key, test]) => (
                <Box key={key} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getStatusIcon(test.status)}
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </Typography>
                    <Chip
                      label={test.status}
                      color={getStatusColor(test.status) as any}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {test.message}
                  </Typography>

                  {/* Additional details */}
                  {test.response && (
                    <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>
                      Response: {test.response}
                    </Typography>
                  )}

                  {test.embeddingDimensions && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Embedding dimensions: {test.embeddingDimensions}
                    </Typography>
                  )}

                  {test.tokensUsed && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Tokens used: {test.tokensUsed}
                    </Typography>
                  )}

                  {test.tables && (
                    <Box sx={{ mt: 1 }}>
                      {Object.entries(test.tables).map(([tableName, tableInfo]: [string, any]) => (
                        <Typography key={tableName} variant="body2" sx={{ ml: 2 }}>
                          {tableName}: {tableInfo.exists ? '✓' : '✗'} {tableInfo.error || ''}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {test.error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {test.error}
                    </Alert>
                  )}

                  <Divider sx={{ mt: 2 }} />
                </Box>
              ))}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Test run at: {new Date(results.timestamp).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  )
}
