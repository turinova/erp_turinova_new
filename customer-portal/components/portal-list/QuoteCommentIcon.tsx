'use client'

import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

type Props = {
  comment?: string | null
}

/** Comment as icon + tooltip only (no text column clutter). */
export function QuoteCommentIcon({ comment }: Props) {
  const text = typeof comment === 'string' ? comment.trim() : ''

  if (!text) {
    return (
      <Typography variant="body2" color="text.disabled" component="span">
        —
      </Typography>
    )
  }

  return (
    <Tooltip
      title={<span style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{text}</span>}
      enterDelay={300}
      placement="top"
      arrow
      slotProps={{
        tooltip: { sx: { maxWidth: 360 } }
      }}
    >
      <IconButton
        size="small"
        aria-label="Megjegyzés megtekintése"
        onClick={e => e.stopPropagation()}
        sx={{ color: 'text.secondary' }}
      >
        <i className="ri-chat-3-line" style={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  )
}
