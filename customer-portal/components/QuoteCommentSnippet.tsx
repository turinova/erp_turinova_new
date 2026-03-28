'use client'

import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'

type QuoteCommentSnippetProps = {
  comment?: string | null
}

/**
 * Two-line clamped comment for saved/orders tables; full text in tooltip (hover + keyboard focus).
 */
export function QuoteCommentSnippet({ comment }: QuoteCommentSnippetProps) {
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
      enterDelay={400}
      placement="top-start"
      arrow
      slotProps={{
        tooltip: {
          sx: { maxWidth: 400 }
        }
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        tabIndex={0}
        component="div"
        sx={{
          maxWidth: 280,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          outline: 'none',
          cursor: 'default',
          '&:focus-visible': {
            boxShadow: theme => `0 0 0 2px ${theme.palette.primary.main}`,
            borderRadius: 0.5
          }
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  )
}
