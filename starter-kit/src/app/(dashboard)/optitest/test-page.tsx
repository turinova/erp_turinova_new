'use client'

import React, { useState } from 'react'

import { Button, Box, Typography } from '@mui/material'

export default function TestPage() {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const testOptimize = async () => {
    console.log('Test optimize called!')
    setIsOptimizing(true)
    
    try {
      const response = await fetch('http://localhost:8080/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          board: {
            w_mm: 2800,
            h_mm: 2070,
            trim_top_mm: 10,
            trim_right_mm: 10,
            trim_bottom_mm: 10,
            trim_left_mm: 10
          },
          parts: [
            {
              id: "test-1",
              w_mm: 600,
              h_mm: 400,
              qty: 2,
              allow_rot_90: true,
              grain_locked: false
            }
          ],
          params: {
            kerf_mm: 3,
            seed: 123456
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      setResult(`Success! Placed ${data.placements.length} panels`)
      console.log('Optimization result:', data)
    } catch (error) {
      setResult(`Error: ${error}`)
      console.error('Optimization error:', error)
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Optimization Test
      </Typography>
      
      <Button
        variant="contained"
        onClick={testOptimize}
        disabled={isOptimizing}
        sx={{ mb: 2 }}
      >
        {isOptimizing ? 'Testing...' : 'Test Optimization'}
      </Button>
      
      {result && (
        <Typography variant="body1" color={result.includes('Error') ? 'error' : 'success'}>
          {result}
        </Typography>
      )}
    </Box>
  )
}
