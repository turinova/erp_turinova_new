'use client'

import { useMemo } from 'react'
import { Box, TextField, Typography } from '@mui/material'

type Props = {
  html: string
  onHtmlChange: (html: string) => void
  defaultMode?: 'visual' | 'html'
}

export default function OrderStatusTemplateRichEditor({ html, onHtmlChange }: Props) {
  const previewDoc = useMemo(() => {
    const raw = (html || '').trim()
    if (!raw) {
      return '<!doctype html><html><body style="margin:0;padding:12px;font-family:Arial,sans-serif;color:#666">Nincs HTML tartalom.</body></html>'
    }

    if (/^\s*<!doctype\b/i.test(raw) || /^\s*<html[\s>]/i.test(raw)) {
      return raw
    }

    return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:0;padding:0;">${raw}</body></html>`
  }, [html])

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, lineHeight: 1.55, maxWidth: 760 }}>
        Ez a szerkesztő kizárólag <strong>nyers HTML</strong> módot használ. A korábbi Szöveg nézet eltávolítva,
        mert a renderelést és a táblázat-tokeneket roncsolta.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={18}
          maxRows={30}
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
          placeholder="<table>... {{order_items_table}} ...</table>"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            '& textarea': { fontSize: 13, lineHeight: 1.45 }
          }}
        />

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 360 }}>
          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
            <Typography variant="caption" color="text.secondary">
              Renderelt előnézet (tokenek cseréje nélkül)
            </Typography>
          </Box>
          <Box sx={{ height: 420 }}>
            <iframe
              title="order-status-template-preview"
              srcDoc={previewDoc}
              style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
