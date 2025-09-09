'use client'

// React Imports
import React from 'react'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

// Third-party Imports
import { toast } from 'react-toastify'

// Component Imports
import VerticalLayout from '@layouts/VerticalLayout'

const TestToastPage = () => {
  const showSuccessToast = () => {
    toast.success('Panel sikeresen hozzáadva!', {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    })
  }

  const showUpdateToast = () => {
    toast.success('Panel sikeresen frissítve!', {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    })
  }

  const showDeleteToast = () => {
    toast.success('Panel sikeresen törölve!', {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    })
  }

  return (
    <VerticalLayout>
      <Box className='flex flex-col gap-6'>
        <Typography variant='h4' className='mb-2'>
          Toast Test Page
        </Typography>
        
        <Box className='flex flex-col gap-4'>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={showSuccessToast}
            sx={{ width: 'fit-content' }}
          >
            Test Add Success Toast
          </Button>
          
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={showUpdateToast}
            sx={{ width: 'fit-content' }}
          >
            Test Update Success Toast
          </Button>
          
          <Button 
            variant="contained" 
            color="error" 
            onClick={showDeleteToast}
            sx={{ width: 'fit-content' }}
          >
            Test Delete Success Toast
          </Button>
        </Box>
      </Box>
    </VerticalLayout>
  )
}

export default TestToastPage
