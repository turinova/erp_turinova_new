'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import { toast } from 'react-toastify'

export default function DatabaseTemplateCard() {
  const [open, setOpen] = useState(false)
  const [databaseSQL, setDatabaseSQL] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    setIsLoading(true)
    
    try {
      // Fetch the database template file
      const response = await fetch('/database-template.sql')
      const text = await response.text()
      setDatabaseSQL(text)
    } catch (error) {
      console.error('Error loading database template:', error)
      toast.error('Hiba történt a sablon betöltése során')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(databaseSQL)
      toast.success('SQL sablon másolva a vágólapra!')
      handleClose()
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Hiba történt a másolás során')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([databaseSQL], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'turinova-database-template.sql'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success('SQL sablon letöltve!')
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ 
              backgroundColor: 'success.main', 
              borderRadius: 2, 
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className='ri-database-2-line text-3xl text-white' />
            </Box>
            <div className='flex-1'>
              <Typography variant='h5' className='font-bold mb-1'>
                Adatbázis Sablon
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Teljes Turinova ERP adatbázis séma új cégek számára
              </Typography>
            </div>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant='contained'
              color='primary'
              startIcon={<i className='ri-file-copy-line' />}
              onClick={handleOpen}
              fullWidth
            >
              Sablon megtekintése
            </Button>
          </Box>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant='caption' color='text.secondary'>
              <i className='ri-information-line' /> Tartalmaz: 46 tábla, 21 függvény, 36+ trigger, 2 view, indexek és mintaadatok
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className='ri-database-2-line text-2xl' />
            <span>Turinova ERP Adatbázis Sablon</span>
          </Box>
          <IconButton onClick={handleClose} size='small'>
            <i className='ri-close-line' />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <Typography>Betöltés...</Typography>
            </Box>
          ) : (
            <>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                Ez a sablon tartalmazza a teljes Turinova ERP adatbázis sémát, beleértve az összes táblát, függvényt, triggert, view-t és indexet.
              </Typography>
              
              <Box sx={{ 
                bgcolor: 'action.hover', 
                p: 2, 
                borderRadius: 1, 
                maxHeight: 400, 
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {databaseSQL.substring(0, 2000)}...
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 2 }}>
                  ({databaseSQL.split('\n').length} sor, {(databaseSQL.length / 1024).toFixed(2)} KB)
                </Typography>
              </Box>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                <Typography variant='body2' color='warning.dark'>
                  <strong>⚠️ Figyelem:</strong> Ezt az SQL-t csak új, üres Supabase projektben futtassa. Létező adatbázisban történő futtatás problémákat okozhat.
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={handleDownload}
            startIcon={<i className='ri-download-line' />}
            disabled={isLoading}
          >
            Letöltés
          </Button>
          <Button 
            onClick={handleCopy}
            variant='contained'
            startIcon={<i className='ri-file-copy-line' />}
            disabled={isLoading}
          >
            Másolás vágólapra
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

