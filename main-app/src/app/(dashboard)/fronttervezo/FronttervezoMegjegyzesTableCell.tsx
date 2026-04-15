'use client'

import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined'
import { Box, TableCell, Tooltip, Typography } from '@mui/material'

type Props = {
  megjegyzes?: string | null
}

/** Oszlop: ikon + tooltip, ha van szöveg; különben „—”. Nem indít szerkesztést (stopPropagation). */
export default function FronttervezoMegjegyzesTableCell({ megjegyzes }: Props) {
  const t = (megjegyzes ?? '').trim()

  if (!t) {
    return (
      <TableCell align="center">
        <Typography variant="body2" color="text.secondary">
          —
        </Typography>
      </TableCell>
    )
  }

  return (
    <TableCell align="center" onClick={e => e.stopPropagation()} sx={{ verticalAlign: 'middle' }}>
      <Tooltip
        title={
          <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-wrap', maxWidth: 420 }}>
            {t}
          </Box>
        }
      >
        <Box
          component="span"
          sx={{ display: 'inline-flex', cursor: 'help', alignItems: 'center' }}
          aria-label="Megjegyzés"
        >
          <CommentOutlinedIcon color="primary" fontSize="small" />
        </Box>
      </Tooltip>
    </TableCell>
  )
}
