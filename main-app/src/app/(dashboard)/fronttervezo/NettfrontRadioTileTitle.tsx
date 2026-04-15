'use client'

import React from 'react'

import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Box, Link, Typography } from '@mui/material'

import FrontTypeLineCountBadge from './FrontTypeLineCountBadge'
import { getNettfrontCatalog } from './nettfrontCatalog'

type NettfrontRadioTileTitleProps = {
  heading: string

  /** `nettfrontFrontData` value: inomat | festett | folias | alu */
  frontValue: string

  /** Sorok száma a munkamenetben (0 = nincs jelvény) */
  lineCount?: number

  /** aria-label prefix a jelvényhez */
  badgeAriaLabelPrefix?: string
}

/**
 * Cím a Nettfront rádió csempén + opcionális PDF link (ha van a katalógusban).
 * A link kattintása nem váltja a rádiót (stopPropagation).
 */
export default function NettfrontRadioTileTitle({
  heading,
  frontValue,
  lineCount = 0,
  badgeAriaLabelPrefix
}: NettfrontRadioTileTitleProps) {
  const catalog = getNettfrontCatalog(frontValue)
  const ariaPrefix = badgeAriaLabelPrefix ?? heading.replace(/\s+FRONT$/i, '').trim()

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0 }}>
        <Typography
          component="div"
          variant="body1"
          sx={{
            fontWeight: 600,
            lineHeight: 1.3,
            color: 'var(--mui-palette-text-primary)'
          }}
        >
          {heading}
        </Typography>
        <FrontTypeLineCountBadge ariaLabelPrefix={ariaPrefix} count={lineCount} />
      </Box>
      {catalog ? (
        <Link
          href={catalog.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          variant="caption"
          sx={{
            mt: 0.75,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.35,
            fontWeight: 500,
            maxWidth: '100%'
          }}
          aria-label={`${catalog.label} — új lapon`}
        >
          <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} aria-hidden />
          {catalog.label}
        </Link>
      ) : null}
    </Box>
  )
}
