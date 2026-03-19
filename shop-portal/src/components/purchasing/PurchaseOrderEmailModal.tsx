'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert
} from '@mui/material'
import {
  Close as CloseIcon,
  Send as SendIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  StrikethroughS as StrikeIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  FormatAlignJustify as AlignJustifyIcon,
  TableChart as TableIcon,
  Draw as SignatureIcon,
  Description as TemplateIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/core'
import '@/libs/styles/tiptapEditor.css'
import { toast } from 'react-toastify'

type ComposeItem = {
  line: number
  product_name: string
  sku: string
  supplier_sku: string
  quantity: number
  unit_shortform: string
}

type Identity = {
  id: string
  from_name: string
  from_email: string
  signature_html: string | null
  is_default: boolean
}

type ComposeResponse = {
  po_number: string
  email_sent: boolean
  supplier_has_email_channel: boolean
  default_to: string
  subject: string
  email_po_intro_html: string
  items: ComposeItem[]
  identities: Identity[]
  default_identity_id: string | null
  smtp_configured: boolean
}

/** Numbered lines with optional middle SKU segment (same shape as main-app for regex + e-mail clients). */
function buildLineListHtml(items: ComposeItem[]): string {
  let listHTML = ''
  items.forEach((item, index) => {
    const unitName = item.unit_shortform || '-'
    const productName = item.product_name || '-'
    const skuPart = (item.supplier_sku || item.sku || '').trim()
    if (skuPart) {
      listHTML += `<strong>${index + 1}.</strong> ${productName} - ${skuPart} - <strong>${item.quantity} - ${unitName}</strong><br>`
    } else {
      listHTML += `<strong>${index + 1}.</strong> ${productName} - <strong>${item.quantity} - ${unitName}</strong><br>`
    }
  })
  return listHTML
}

function buildAutoContent(introHtml: string | null, items: ComposeItem[], signature: string | null): string {
  let content = ''
  if (introHtml?.trim()) {
    content += introHtml.trim() + '<br><br>'
  }
  if (items.length > 0) {
    content += buildLineListHtml(items) + '<br>'
  }
  if (signature?.trim()) {
    content += signature.trim()
  }
  return content
}

const EditorToolbar = ({
  editor,
  onInsertTable,
  onInsertSignature,
  hasSignature,
  onInsertTemplate,
  hasTemplate,
  onRemoveSKUs
}: {
  editor: Editor | null
  onInsertTable: () => void
  onInsertSignature: () => void
  hasSignature: boolean
  onInsertTemplate: () => void
  hasTemplate: boolean
  onRemoveSKUs: () => void
}) => {
  if (!editor) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        p: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover'
      }}
    >
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleBold().run()}
        color={editor.isActive('bold') ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('bold') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <BoldIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        color={editor.isActive('italic') ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('italic') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <ItalicIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        color={editor.isActive('underline') ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('underline') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <UnderlineIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        color={editor.isActive('strike') ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('strike') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <StrikeIcon fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive({ textAlign: 'left' }) ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <AlignLeftIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive({ textAlign: 'center' }) ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <AlignCenterIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive({ textAlign: 'right' }) ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <AlignRightIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        color={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive({ textAlign: 'justify' }) ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <AlignJustifyIcon fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={onInsertTable}
        color="primary"
        sx={{
          border: 1,
          borderColor: 'primary.main',
          borderRadius: 1
        }}
        title="Rendelés tételei beszúrása"
      >
        <TableIcon fontSize="small" />
      </IconButton>
      {hasTemplate && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton
            size="small"
            onClick={onInsertTemplate}
            color="primary"
            sx={{
              border: 1,
              borderColor: 'primary.main',
              borderRadius: 1
            }}
            title="Email sablon beszúrása"
          >
            <TemplateIcon fontSize="small" />
          </IconButton>
        </>
      )}
      {hasSignature && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton
            size="small"
            onClick={onInsertSignature}
            color="primary"
            sx={{
              border: 1,
              borderColor: 'primary.main',
              borderRadius: 1
            }}
            title="Aláírás beszúrása"
          >
            <SignatureIcon fontSize="small" />
          </IconButton>
        </>
      )}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={onRemoveSKUs}
        color="primary"
        sx={{
          border: 1,
          borderColor: 'primary.main',
          borderRadius: 1
        }}
        title="SKU eltávolítása a tételekből"
      >
        <DeleteSweepIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

type Props = {
  open: boolean
  purchaseOrderId: string
  onClose: () => void
  onSent: () => void
}

export default function PurchaseOrderEmailModal({ open, purchaseOrderId, onClose, onSent }: Props) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [identityId, setIdentityId] = useState<string>('')
  const [compose, setCompose] = useState<ComposeResponse | null>(null)
  const [poItems, setPoItems] = useState<ComposeItem[]>([])
  const [partnerTemplate, setPartnerTemplate] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  const identities = compose?.identities ?? []

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: 'Írja be az üzenetet...'
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    immediatelyRender: false
  })

  const loadCompose = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/email-compose`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Betöltés sikertelen')
      }
      const c = data as ComposeResponse
      setCompose(c)
      setTo(c.default_to || '')
      setSubject(`Beszállítói rendelés - ${c.po_number}`)
      setPoItems(c.items || [])
      const intro = (c.email_po_intro_html || '').trim() || null
      setPartnerTemplate(intro)
      const id =
        c.default_identity_id ||
        c.identities.find((i) => i.is_default)?.id ||
        c.identities[0]?.id ||
        ''
      setIdentityId(id)
      const idRow = c.identities.find((i) => i.id === id) || c.identities[0]
      setSignature(idRow?.signature_html || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Betöltés sikertelen')
      setCompose(null)
      setPoItems([])
      setPartnerTemplate(null)
      setSignature(null)
    } finally {
      setLoading(false)
    }
  }, [purchaseOrderId])

  useEffect(() => {
    if (!open || !purchaseOrderId) return
    loadCompose()
  }, [open, purchaseOrderId, loadCompose])

  useEffect(() => {
    if (open && editor) {
      editor.commands.clearContent()
    }
  }, [open, purchaseOrderId, editor])

  useEffect(() => {
    if (identityId && identities.length > 0) {
      const row = identities.find((i) => i.id === identityId)
      if (row) setSignature(row.signature_html || null)
    }
  }, [identityId, identities])

  useEffect(() => {
    if (open && editor && !loading && compose) {
      const timer = setTimeout(() => {
        if (!editor) return
        const content = buildAutoContent(partnerTemplate, poItems, signature)
        if (content) {
          editor.commands.setContent(content)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, editor, loading, compose, partnerTemplate, poItems, signature])

  const handleClose = () => {
    if (!open) return
    onClose()
  }

  const handleSend = async () => {
    if (!editor) return

    if (!to || !to.trim()) {
      toast.error('Címzett email cím kötelező')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to.trim())) {
      toast.error('Érvényes email cím szükséges')
      return
    }
    if (!subject || !subject.trim()) {
      toast.error('Tárgy kötelező')
      return
    }
    const html = editor.getHTML()
    const textContent = editor.getText()
    if (!textContent.trim()) {
      toast.error('Email tartalom kötelező')
      return
    }
    if (!compose?.supplier_has_email_channel) {
      toast.error('A beszállítónak nincs e-mail rendelési csatornája.')
      return
    }
    if (!compose?.smtp_configured || identities.length === 0 || !identityId) {
      toast.error(
        'Nincs aktív email fiók kiválasztva. Kérjük, hozzon létre egy aktív email fiókot az email beállításokban.'
      )
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          html_body: html,
          identity_id: identityId
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Hiba az email küldésekor')
      }
      toast.success('Email sikeresen elküldve')
      setTo('')
      setSubject('')
      editor.commands.clearContent()
      onSent()
      handleClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba az email küldésekor')
    } finally {
      setSending(false)
    }
  }

  const handleInsertTable = () => {
    if (!editor || poItems.length === 0) {
      toast.warning('Nincsenek tételek a beszúráshoz')
      return
    }
    const listHTML = buildLineListHtml(poItems)
    editor.chain().focus().insertContent(listHTML).run()
    toast.success('Tételek beszúrva')
  }

  const handleInsertTemplate = () => {
    if (!editor || !partnerTemplate) {
      toast.warning('Nincs elérhető email sablon')
      return
    }
    editor.chain().focus().insertContent(partnerTemplate).run()
    toast.success('Email sablon beszúrva')
  }

  const handleInsertSignature = () => {
    if (!editor || !signature) {
      toast.warning('Nincs elérhető aláírás')
      return
    }
    editor.chain().focus().insertContent(signature).run()
    toast.success('Aláírás beszúrva')
  }

  const handleRemoveSKUs = () => {
    if (!editor) return
    const currentHTML = editor.getHTML()
    const pattern =
      /(<strong>)?(\d+)\.(<\/strong>)?\s*(.*?)\s*-\s*(.*?)\s*-\s*(<strong>)?(\d+(?:[.,]\d+)?\s*-\s*[^<]+)(<\/strong>)?/g
    const newHTML = currentHTML.replace(pattern, (_match, p1, p2, p3, p4, _p5, p6, p7, p8) => {
      const listBoldOpen = p1 || ''
      const listBoldClose = p3 || ''
      const qtyBoldOpen = p6 || ''
      const qtyBoldClose = p8 || ''
      return `${listBoldOpen}${p2}.${listBoldClose} ${p4} - ${qtyBoldOpen}${p7}${qtyBoldClose}`
    })
    editor.commands.setContent(newHTML)
    toast.success('SKU-k eltávolítva')
  }

  const hasTemplate = !!partnerTemplate?.trim()
  const hasSignature = !!signature?.trim()

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" component="div">
          E-mail küldés
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ ml: 2 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {error && (
            <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          {compose && !compose.supplier_has_email_channel && (
            <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
              <Alert severity="warning">
                A beszállítónak nincs e-mail rendelési csatornája. Adjon hozzá egyet a beszállító
                szerkesztőben.
              </Alert>
            </Box>
          )}
          {compose && !compose.smtp_configured && (
            <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
              <Alert severity="warning">
                Nincs aktív email fiók. Kérjük, hozzon létre egy aktív email fiókot az email beállításokban.
              </Alert>
            </Box>
          )}

          {identities.length > 0 ? (
            <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Feladó</InputLabel>
                <Select
                  value={identityId}
                  onChange={(e) => setIdentityId(e.target.value as string)}
                  label="Feladó"
                >
                  {identities.map((setting) => (
                    <MenuItem key={setting.id} value={setting.id}>
                      {setting.from_name} - {setting.from_email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          ) : (
            <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
              <Typography variant="body2" color="warning.main">
                Nincs aktív email fiók. Kérjük, hozzon létre egy aktív email fiókot az email beállításokban.
              </Typography>
            </Box>
          )}

          <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Címzett"
              placeholder="email@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
          </Box>

          <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Tárgy"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <EditorToolbar
              editor={editor}
              onInsertTable={handleInsertTable}
              onInsertSignature={handleInsertSignature}
              hasSignature={hasSignature}
              onInsertTemplate={handleInsertTemplate}
              hasTemplate={hasTemplate}
              onRemoveSKUs={handleRemoveSKUs}
            />
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderTop: 0,
                borderRadius: '0 0 4px 4px',
                minHeight: '350px',
                position: 'relative',
                '& .ProseMirror': {
                  minHeight: '350px',
                  fontSize: '14px',
                  p: 2
                },
                '& .ProseMirror table': {
                  borderCollapse: 'collapse',
                  width: '100%',
                  margin: '16px 0'
                },
                '& .ProseMirror table td, & .ProseMirror table th': {
                  border: '1px solid #ddd',
                  padding: '8px'
                },
                '& .ProseMirror table th': {
                  backgroundColor: '#f5f5f5',
                  fontWeight: 'bold'
                }
              }}
            >
              {loading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              )}
              <EditorContent editor={editor} />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Mégse</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          disabled={sending}
        >
          {sending ? 'Küldés...' : 'Küldés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
