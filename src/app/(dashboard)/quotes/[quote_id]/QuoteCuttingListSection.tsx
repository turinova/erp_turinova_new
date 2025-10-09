'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Tooltip
} from '@mui/material'
import LocationSearchingSharpIcon from '@mui/icons-material/LocationSearchingSharp'
import Filter2Icon from '@mui/icons-material/Filter2'
import ContentCutIcon from '@mui/icons-material/ContentCut'

interface Panel {
  id: string
  material_id: string
  material_machine_code: string
  material_name: string
  width_mm: number
  height_mm: number
  quantity: number
  label: string | null
  edge_a_code: string | null  // Top (Hosszú alsó)
  edge_c_code: string | null  // Bottom (Hosszú felső)
  edge_b_code: string | null  // Left (Széles bal)
  edge_d_code: string | null  // Right (Széles jobb)
  duplungolas: boolean
  panthelyfuras_quantity: number
  szogvagas: boolean
}

interface QuoteCuttingListSectionProps {
  panels: Panel[]
}

export default function QuoteCuttingListSection({ panels }: QuoteCuttingListSectionProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Szabásjegyzék
        </Typography>

        <TableContainer sx={{ border: '1px solid rgba(224, 224, 224, 1)' }}>
          <Table 
            size="small"
            sx={{
              '& .MuiTableCell-root': {
                borderRight: '1px solid rgba(224, 224, 224, 1)',
                padding: '6px 8px',
                fontSize: '0.875rem',
                '&:last-child': {
                  borderRight: 'none'
                }
              },
              '& .MuiTableHead-root .MuiTableCell-root': {
                padding: '8px',
                fontSize: '0.875rem'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell><strong>Anyag</strong></TableCell>
                <TableCell align="right"><strong>Hosszúság</strong></TableCell>
                <TableCell align="right"><strong>Szélesség</strong></TableCell>
                <TableCell align="right"><strong>Darab</strong></TableCell>
                <TableCell><strong>Jelölés</strong></TableCell>
                <TableCell><strong>Hosszú alsó</strong></TableCell>
                <TableCell><strong>Hosszú felső</strong></TableCell>
                <TableCell><strong>Széles bal</strong></TableCell>
                <TableCell><strong>Széles jobb</strong></TableCell>
                <TableCell align="center"><strong>Egyéb</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {panels.map((panel) => {
                return (
                  <TableRow key={panel.id}>
                    <TableCell>{panel.material_machine_code || panel.material_name}</TableCell>
                    <TableCell align="right">{panel.width_mm}</TableCell>
                    <TableCell align="right">{panel.height_mm}</TableCell>
                    <TableCell align="right">{panel.quantity}</TableCell>
                    <TableCell>{panel.label || '-'}</TableCell>
                    <TableCell>{panel.edge_a_code || ''}</TableCell>
                    <TableCell>{panel.edge_c_code || ''}</TableCell>
                    <TableCell>{panel.edge_b_code || ''}</TableCell>
                    <TableCell>{panel.edge_d_code || ''}</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
                        {panel.panthelyfuras_quantity > 0 && (
                          <Tooltip title={`Pánthelyfúrás (${panel.panthelyfuras_quantity} db)`} arrow>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                              <LocationSearchingSharpIcon fontSize="small" />
                              <Typography variant="caption">{panel.panthelyfuras_quantity}</Typography>
                            </Box>
                          </Tooltip>
                        )}
                        {panel.duplungolas && (
                          <Tooltip title="Duplungolás" arrow>
                            <Filter2Icon fontSize="small" />
                          </Tooltip>
                        )}
                        {panel.szogvagas && (
                          <Tooltip title="Szögvágás" arrow>
                            <ContentCutIcon fontSize="small" />
                          </Tooltip>
                        )}
                        {!panel.panthelyfuras_quantity && !panel.duplungolas && !panel.szogvagas && '-'}
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

