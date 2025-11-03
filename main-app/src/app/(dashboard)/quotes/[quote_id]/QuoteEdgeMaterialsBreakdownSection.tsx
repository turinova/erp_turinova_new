'use client'

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
  Box
} from '@mui/material'

interface EdgeMaterialBreakdown {
  id: string
  material_name: string
  edge_material_name: string
  total_length_m: number
}

interface QuoteEdgeMaterialsBreakdownSectionProps {
  edgeMaterials: EdgeMaterialBreakdown[]
}

export default function QuoteEdgeMaterialsBreakdownSection({ 
  edgeMaterials 
}: QuoteEdgeMaterialsBreakdownSectionProps) {
  
  // Hide if no edge materials
  if (!edgeMaterials || edgeMaterials.length === 0) {
    return null
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Élzáró összesítő
        </Typography>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Anyag</strong></TableCell>
                <TableCell><strong>Élzáró</strong></TableCell>
                <TableCell align="right"><strong>Hossz (m)</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {edgeMaterials.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.material_name}</TableCell>
                  <TableCell>{item.edge_material_name}</TableCell>
                  <TableCell align="right">
                    {item.total_length_m.toFixed(2)} m
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

