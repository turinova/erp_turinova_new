'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import { Box } from '@mui/material'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

// Icons
import { Home as HomeIcon } from '@mui/icons-material'

// Type Imports
import type { Mode } from '@core/types'

const PartnersListClient = ({ mode }: { mode: Mode }) => {
  // States
  const [partners, setPartners] = useState<any[]>([])

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Beszállítók
        </Typography>
      </Breadcrumbs>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant='h4' color='primary'>
            Beszállítók
          </Typography>
          <Button variant='contained' startIcon={<i className='ri-add-line' />}>
            Új beszállító
          </Button>
        </Box>

        <Card>
          <CardContent>
            <Typography variant='h6' sx={{ mb: 2 }}>
              Beszállítók listája
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Itt jelennek meg a beszállítók adatai.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default PartnersListClient
