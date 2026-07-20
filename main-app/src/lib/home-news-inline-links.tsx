import React from 'react'
import Link from 'next/link'
import { Link as MuiLink } from '@mui/material'

/** Matches https URLs and internal app paths like /opti, /fronttervezo */
const INLINE_LINK_RE =
  /(https?:\/\/[^\s<>"'`]+|\/[A-Za-z0-9][A-Za-z0-9\-._~/%]*)/g

const TRAILING_PUNCT_RE = /[.,;:!?)}\]»"'”]+$/

function splitTrailingPunctuation(raw: string): { href: string; trailing: string } {
  let href = raw
  let trailing = ''
  const match = href.match(TRAILING_PUNCT_RE)
  if (match) {
    trailing = match[0]
    href = href.slice(0, -trailing.length)
  }
  // Trim unbalanced closing paren if URL had none open
  if (href.endsWith(')') && !href.includes('(')) {
    trailing = ')' + trailing
    href = href.slice(0, -1)
  }
  return { href, trailing }
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

function InlinePathLink({ href }: { href: string }) {
  if (isExternalHref(href)) {
    return (
      <MuiLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        sx={{ fontWeight: 600, color: 'info.main', wordBreak: 'break-all' }}
      >
        {href}
      </MuiLink>
    )
  }

  return (
    <MuiLink
      component={Link}
      href={href}
      underline="hover"
      sx={{ fontWeight: 600, color: 'info.main' }}
    >
      {href}
    </MuiLink>
  )
}

/** Turn plain text with /paths and https URLs into React nodes with clickable links. */
export function renderHomeNewsInlineText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(INLINE_LINK_RE.source, 'g')

  while ((match = re.exec(text)) !== null) {
    const start = match.index
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }

    const raw = match[0]
    const { href, trailing } = splitTrailingPunctuation(raw)

    if (href.length > 1 || isExternalHref(href)) {
      parts.push(<InlinePathLink key={`l-${start}`} href={href} />)
      if (trailing) parts.push(trailing)
    } else {
      parts.push(raw)
    }

    lastIndex = start + raw.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 ? parts[0] : parts
}
