'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Link as MuiLink,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { renderHomeNewsInlineText } from '@/lib/home-news-inline-links'
import { sortHomeNewsPosts, type HomeNewsKind, type HomeNewsPost } from '@/lib/home-news-server'

const UNLOCK_STORAGE_KEY = 'home_news_unlocked_until'
const PIN_STORAGE_KEY = 'home_news_pin'
const EXPANDED_STORAGE_KEY = 'home_news_expanded'
const LAST_SEEN_STORAGE_KEY = 'home_news_last_seen_at'
const UNLOCK_MS = 30 * 60 * 1000
const COMPACT_PREVIEW_LIMIT = 3
const NEW_WITHIN_MS = 48 * 60 * 60 * 1000

interface Props {
  initialPosts: HomeNewsPost[]
}

function formatPostDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

function isFreshPost(iso: string) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= NEW_WITHIN_MS
}

function latestCreatedAt(posts: HomeNewsPost[]): string | null {
  if (posts.length === 0) return null
  return posts.reduce((latest, post) => {
    return !latest || post.created_at > latest ? post.created_at : latest
  }, posts[0].created_at)
}

function readUnlockExpiry(): number {
  if (typeof window === 'undefined') return 0
  const raw = sessionStorage.getItem(UNLOCK_STORAGE_KEY)
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function isUnlockedNow(): boolean {
  return readUnlockExpiry() > Date.now()
}

function readStoredPin(): string {
  if (typeof window === 'undefined') return ''
  if (!isUnlockedNow()) return ''
  const pin = sessionStorage.getItem(PIN_STORAGE_KEY) || ''
  return /^\d{4}$/.test(pin) ? pin : ''
}

function persistUnlock(pin: string, unlockedUntil?: number) {
  const until = unlockedUntil ?? Date.now() + UNLOCK_MS
  sessionStorage.setItem(UNLOCK_STORAGE_KEY, String(until))
  sessionStorage.setItem(PIN_STORAGE_KEY, pin)
}

function clearUnlock() {
  sessionStorage.removeItem(UNLOCK_STORAGE_KEY)
  sessionStorage.removeItem(PIN_STORAGE_KEY)
}

function isExternalLink(url: string) {
  return /^https?:\/\//i.test(url)
}

function headerSummary(posts: HomeNewsPost[]) {
  const taskCount = posts.filter(p => p.kind === 'task').length
  const newsCount = posts.filter(p => p.kind !== 'task').length
  const parts: string[] = []
  if (taskCount > 0) parts.push(`${taskCount} feladat`)
  if (newsCount > 0) parts.push(`${newsCount} hír`)
  if (parts.length === 0) return 'Aktív tájékoztatások'
  return parts.join(' · ')
}

function PostKindChips({ post }: { post: HomeNewsPost }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
      <Chip
        size="small"
        label={post.kind === 'task' ? 'Feladat' : 'Hír'}
        color={post.kind === 'task' ? 'warning' : 'info'}
        sx={{ fontWeight: 600, height: 22 }}
      />
      {isFreshPost(post.created_at) ? (
        <Chip size="small" label="Új" color="error" variant="outlined" sx={{ fontWeight: 700, height: 22 }} />
      ) : null}
    </Stack>
  )
}

export default function HomeNewsCard({ initialPosts }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [unlocked, setUnlocked] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<HomeNewsPost | null>(null)
  const [pin, setPin] = useState('')
  const [kind, setKind] = useState<HomeNewsKind>('news')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  useEffect(() => {
    setUnlocked(isUnlockedNow())

    const savedExpanded = localStorage.getItem(EXPANDED_STORAGE_KEY) === '1'
    const lastSeen = localStorage.getItem(LAST_SEEN_STORAGE_KEY)
    const newest = latestCreatedAt(initialPosts)
    const hasUnseen = Boolean(newest && (!lastSeen || newest > lastSeen))

    // Default compact; open if user left it open or there is a newer post than last visit
    setExpanded(savedExpanded || hasUnseen)

    if (newest) {
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, newest)
    }
  }, [initialPosts])

  const setExpandedPersist = (next: boolean) => {
    setExpanded(next)
    localStorage.setItem(EXPANDED_STORAGE_KEY, next ? '1' : '0')
  }

  const visiblePosts = useMemo(() => {
    if (expanded) return posts
    return posts.slice(0, COMPACT_PREVIEW_LIMIT)
  }, [expanded, posts])

  const hiddenCount = expanded ? 0 : Math.max(0, posts.length - COMPACT_PREVIEW_LIMIT)
  const freshCount = posts.filter(p => isFreshPost(p.created_at)).length

  const openPinDialog = () => {
    setError(null)
    setPin('')
    setPinDialogOpen(true)
  }

  const lockEditing = () => {
    clearUnlock()
    setUnlocked(false)
    setPin('')
  }

  const verifyPin = async () => {
    setBusy(true)
    setError(null)
    try {
      const entered = pin.trim()
      const res = await fetch('/api/home-news/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: entered })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Hibás kód')
        return
      }
      const until = typeof data.unlockedUntil === 'number' ? data.unlockedUntil : Date.now() + UNLOCK_MS
      persistUnlock(entered, until)
      setUnlocked(true)
      setPin(entered)
      setPinDialogOpen(false)
      setExpandedPersist(true)
    } catch {
      setError('Nem sikerült ellenőrizni a kódot')
    } finally {
      setBusy(false)
    }
  }

  const openCreate = () => {
    setEditingPost(null)
    setKind('news')
    setTitle('')
    setBody('')
    setLinkUrl('')
    setLinkLabel('')
    setError(null)
    setEditorOpen(true)
  }

  const openEdit = (post: HomeNewsPost) => {
    setEditingPost(post)
    setKind(post.kind === 'task' ? 'task' : 'news')
    setTitle(post.title)
    setBody(post.body ?? '')
    setLinkUrl(post.link_url ?? '')
    setLinkLabel(post.link_label ?? '')
    setError(null)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    if (busy) return
    setEditorOpen(false)
    setEditingPost(null)
    setError(null)
  }

  const resolvePinForMutation = useCallback((): string | null => {
    const fromState = pin.trim().length === 4 ? pin.trim() : ''
    const fromStorage = readStoredPin()
    const resolved = fromState || fromStorage
    if (resolved) return resolved
    setError('A szerkesztéshez add meg a kódot')
    setPinDialogOpen(true)
    return null
  }, [pin])

  const savePost = async () => {
    const pinForRequest = resolvePinForMutation()
    if (!pinForRequest) return

    setBusy(true)
    setError(null)
    try {
      const payload = {
        pin: pinForRequest,
        kind,
        title: title.trim(),
        body: body.trim() || null,
        link_url: linkUrl.trim() || null,
        link_label: linkLabel.trim() || null
      }
      const isEdit = Boolean(editingPost)
      const res = await fetch(isEdit ? `/api/home-news/${editingPost!.id}` : '/api/home-news', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Nem sikerült menteni')
        return
      }
      if (isEdit) {
        setPosts(prev => sortHomeNewsPosts(prev.map(p => (p.id === data.id ? data : p))))
      } else {
        setPosts(prev => sortHomeNewsPosts([data, ...prev]).slice(0, 8))
        setExpandedPersist(true)
      }
      persistUnlock(pinForRequest)
      setPin(pinForRequest)
      setEditorOpen(false)
      setEditingPost(null)
      setError(null)
    } catch {
      setError('Nem sikerült menteni')
    } finally {
      setBusy(false)
    }
  }

  const deletePost = async (post: HomeNewsPost) => {
    const pinForRequest = resolvePinForMutation()
    if (!pinForRequest) return
    if (!window.confirm('Biztosan törlöd ezt a tájékoztatást?')) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/home-news/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinForRequest })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Nem sikerült törölni')
        return
      }
      setPosts(prev => prev.filter(p => p.id !== post.id))
      persistUnlock(pinForRequest)
      setPin(pinForRequest)
    } catch {
      setError('Nem sikerült törölni')
    } finally {
      setBusy(false)
    }
  }

  const renderPostBody = (post: HomeNewsPost) => (
    <>
      {post.body ? (
        <Typography
          variant="body1"
          color="text.primary"
          sx={{ mt: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
        >
          {renderHomeNewsInlineText(post.body)}
        </Typography>
      ) : null}
      {post.link_url ? (
        <Box sx={{ mt: 1 }}>
          {isExternalLink(post.link_url) ? (
            <MuiLink
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                color: 'info.main'
              }}
            >
              {post.link_label || 'Megnyitás'}
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </MuiLink>
          ) : (
            <MuiLink
              component={Link}
              href={post.link_url}
              underline="hover"
              sx={{ fontWeight: 600, color: 'info.main' }}
            >
              {post.link_label || 'Megnyitás'} →
            </MuiLink>
          )}
        </Box>
      ) : null}
    </>
  )

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Hírek/Feladatok
      </Typography>

      <Paper
        sx={{
          border: '2px solid',
          borderColor: 'info.main',
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ bgcolor: 'info.main', px: 1.5, py: 0.75 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            onClick={() => setExpandedPersist(!expanded)}
            sx={{ cursor: 'pointer', minWidth: 0, flex: 1, py: 0.25 }}
          >
            {expanded ? (
              <ExpandLessIcon sx={{ color: 'white' }} />
            ) : (
              <ExpandMoreIcon sx={{ color: 'white' }} />
            )}
            <Typography sx={{ color: 'white', fontWeight: 'bold' }} noWrap>
              {headerSummary(posts)}
              {!expanded && freshCount > 0 ? ` · ${freshCount} új` : ''}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            {unlocked ? (
              <>
                <Button
                  size="small"
                  onClick={openCreate}
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.7)' }}
                  variant="outlined"
                >
                  + Új
                </Button>
                <Button size="small" onClick={lockEditing} sx={{ color: 'white' }}>
                  Zár
                </Button>
              </>
            ) : (
              <Button size="small" onClick={openPinDialog} sx={{ color: 'white' }}>
                Szerkesztés
              </Button>
            )}
          </Stack>
        </Stack>

        {posts.length === 0 ? (
          <Box sx={{ py: 2.5, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Nincs aktív tájékoztatás
            </Typography>
          </Box>
        ) : (
          <>
            {visiblePosts.map((post, index) => {
              const fresh = isFreshPost(post.created_at)
              const isLastVisible = index === visiblePosts.length - 1 && hiddenCount === 0

              return (
                <Box
                  key={post.id}
                  sx={{
                    px: expanded ? 2.5 : 2,
                    py: expanded ? 2 : 1.25,
                    bgcolor: fresh
                      ? theme =>
                          alpha(
                            post.kind === 'task' ? theme.palette.warning.main : theme.palette.info.main,
                            0.06
                          )
                      : 'background.paper',
                    borderBottom: !isLastVisible || hiddenCount > 0 ? '1px solid' : 'none',
                    borderColor: 'divider'
                  }}
                >
                  {expanded ? (
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <PostKindChips post={post} />
                        </Stack>
                        <Typography
                          variant="body1"
                          color="text.primary"
                          sx={{ fontWeight: 700, lineHeight: 1.4 }}
                        >
                          {post.title}
                        </Typography>
                        {renderPostBody(post)}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 1 }}
                        >
                          {formatPostDate(post.created_at)}
                        </Typography>
                      </Box>
                      {unlocked ? (
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0, mt: -0.5 }}>
                          <IconButton size="small" aria-label="Szerkesztés" onClick={() => openEdit(post)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" aria-label="Törlés" onClick={() => deletePost(post)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : null}
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PostKindChips post={post} />
                      <Typography
                        variant="body1"
                        color="text.primary"
                        sx={{
                          fontWeight: 700,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {post.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {formatPostDate(post.created_at)}
                      </Typography>
                      {unlocked ? (
                        <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                          <IconButton size="small" aria-label="Szerkesztés" onClick={() => openEdit(post)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" aria-label="Törlés" onClick={() => deletePost(post)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : null}
                    </Stack>
                  )}
                </Box>
              )
            })}

            <Collapse in={!expanded && hiddenCount > 0}>
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  textAlign: 'center',
                  borderTop: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Button size="small" onClick={() => setExpandedPersist(true)}>
                  +{hiddenCount} további megnyitása
                </Button>
              </Box>
            </Collapse>

            {expanded && posts.length > COMPACT_PREVIEW_LIMIT ? (
              <Box sx={{ px: 2, py: 1, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <Button size="small" onClick={() => setExpandedPersist(false)}>
                  Összecsukás
                </Button>
              </Box>
            ) : null}
          </>
        )}
      </Paper>

      <Dialog open={pinDialogOpen} onClose={() => !busy && setPinDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Szerkesztéshez add meg a kódot</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="4 jegyű kód"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => {
              if (e.key === 'Enter') verifyPin()
            }}
            error={Boolean(error)}
            helperText={error}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinDialogOpen(false)} disabled={busy}>
            Mégse
          </Button>
          <Button variant="contained" onClick={verifyPin} disabled={busy || pin.length !== 4}>
            Belépés
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editorOpen} onClose={closeEditor} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPost ? 'Tájékoztatás szerkesztése' : 'Új tájékoztatás'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl>
              <FormLabel>Típus</FormLabel>
              <RadioGroup
                row
                value={kind}
                onChange={e => setKind(e.target.value === 'task' ? 'task' : 'news')}
              >
                <FormControlLabel value="news" control={<Radio />} label="Hír" />
                <FormControlLabel value="task" control={<Radio />} label="Feladat" />
              </RadioGroup>
            </FormControl>
            <TextField
              label="Cím"
              fullWidth
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Szöveg"
              fullWidth
              multiline
              minRows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              helperText="A szövegben írhatsz útvonalat, pl. /fronttervezo vagy /opti — automatikusan kattintható lesz."
              inputProps={{ maxLength: 800 }}
            />
            <TextField
              label="Külön gomb-link (opcionális)"
              fullWidth
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="/opti"
              helperText="Ha a szövegen kívül külön linket is szeretnél alul."
              inputProps={{ maxLength: 300 }}
            />
            <TextField
              label="Gomb-link felirat (opcionális)"
              fullWidth
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              placeholder="Opti megnyitása"
              disabled={!linkUrl.trim()}
              inputProps={{ maxLength: 80 }}
            />
            {error ? (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor} disabled={busy}>
            Mégse
          </Button>
          <Button variant="contained" onClick={savePost} disabled={busy || !title.trim()}>
            Mentés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
