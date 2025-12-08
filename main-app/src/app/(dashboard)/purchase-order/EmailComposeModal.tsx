'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  Divider,
  CircularProgress
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
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/core'
import { toast } from 'react-toastify'

// Import TipTap styles
import '@/libs/styles/tiptapEditor.css'

interface EmailComposeModalProps {
  open: boolean
  onClose: () => void
  poId: string
  poNumber: string
}

interface PurchaseOrderItem {
  id: string
  product_type: string
  description: string
  quantity: number
  units_id: string | null
  accessories?: {
    sku: string | null
  }
  units?: {
    name: string
    shortform: string | null
  }
}

// Editor Toolbar Component
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
  if (!editor) {
    return null
  }

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

export default function EmailComposeModal({
  open,
  onClose,
  poId,
  poNumber
}: EmailComposeModalProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [loadingItems, setLoadingItems] = useState(false)
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([])
  const [isSending, setIsSending] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [partnerTemplate, setPartnerTemplate] = useState<string | null>(null)

  // Initialize TipTap editor with table extensions
  const editor = useEditor({
    extensions: [
      StarterKit, // Includes Underline, so we don't need to add it separately
      Placeholder.configure({
        placeholder: 'Írja be az üzenetet...'
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    immediatelyRender: false
  })

  // Fetch purchase order items and signature when modal opens
  useEffect(() => {
    if (open && poId) {
      const fetchItems = async () => {
        setLoadingItems(true)
        try {
          const response = await fetch(`/api/purchase-order/${poId}`)
          if (response.ok) {
            const data = await response.json()
            
            // Pre-fill email from partner
            if (data.header?.partner_email) {
              setTo(data.header.partner_email)
            }
            
            // Fetch partner template based on PO's partner_id
            if (data.header?.partner_id) {
              try {
                const partnerResponse = await fetch(`/api/partners/${data.header.partner_id}`)
                if (partnerResponse.ok) {
                  const partnerData = await partnerResponse.json()
                  setPartnerTemplate(partnerData?.email_template_html || null)
                }
              } catch (error) {
                console.error('Error fetching partner template:', error)
                // Don't show error toast, template is optional
              }
            }
            
            // Fetch all units once
            const unitsResponse = await fetch('/api/units')
            let unitsMap = new Map()
            if (unitsResponse.ok) {
              const unitsData = await unitsResponse.json()
              unitsData.forEach((unit: { id: string; name: string; shortform: string | null }) => {
                unitsMap.set(unit.id, unit)
              })
            }
            
            // Map items with units
            const itemsWithUnits = (data.items || []).map((item: PurchaseOrderItem) => {
              const unit = item.units_id ? unitsMap.get(item.units_id) : null
              return {
                ...item,
                units: unit || null
              }
            })
            setPoItems(itemsWithUnits)
          } else {
            toast.error('Hiba a rendelés tételeinek lekérdezésekor')
          }
        } catch (error) {
          console.error('Error fetching PO items:', error)
          toast.error('Hiba a rendelés tételeinek lekérdezésekor')
        } finally {
          setLoadingItems(false)
        }
      }

      // Fetch signature from active SMTP settings
      const fetchSignature = async () => {
        try {
          const response = await fetch('/api/email-settings')
          if (response.ok) {
            const data = await response.json()
            setSignature(data?.signature_html || null)
          }
        } catch (error) {
          console.error('Error fetching signature:', error)
          // Don't show error toast, signature is optional
        }
      }

      fetchItems()
      fetchSignature()
    }
  }, [open, poId])

  // Pre-fill subject when modal opens
  useEffect(() => {
    if (open) {
      setSubject(`Beszállítói rendelés - ${poNumber}`)
      if (editor) {
        editor.commands.clearContent()
      }
    }
  }, [open, poNumber, editor])

  // Auto-insert content when all data is loaded
  useEffect(() => {
    if (open && editor && !loadingItems) {
      // Wait a bit to ensure editor is ready and data is set
      const timer = setTimeout(() => {
        if (!editor) return
        
        let content = ''
        
        // 1. Insert partner template (if exists)
        if (partnerTemplate) {
          content += partnerTemplate + '<br><br>'
        }
        
        // 2. Insert purchase order items (if exists)
        if (poItems.length > 0) {
          let listHTML = ''
          poItems.forEach((item, index) => {
            const unitName = item.units?.shortform || item.units?.name || '-'
            const productName = item.description || '-'
            
            // Include SKU only for accessories (not for materials or linear_materials)
            // Make list number, quantity and unit bold by default
            if (item.product_type === 'accessory' && item.accessories?.sku) {
              listHTML += `<strong>${index + 1}.</strong> ${productName} - ${item.accessories.sku} - <strong>${item.quantity} - ${unitName}</strong><br>`
            } else {
              listHTML += `<strong>${index + 1}.</strong> ${productName} - <strong>${item.quantity} - ${unitName}</strong><br>`
            }
          })
          content += listHTML + '<br>'
        }
        
        // 3. Insert signature (if exists)
        if (signature) {
          content += signature
        }
        
        // Insert all content at once
        if (content) {
          editor.commands.setContent(content)
        }
      }, 300) // Small delay to ensure editor is ready
      
      return () => clearTimeout(timer)
    }
  }, [open, editor, loadingItems, partnerTemplate, poItems, signature])

  const handleClose = () => {
    if (!open) return
    onClose()
  }

  const handleSend = async () => {
    // Validation
    if (!to || !to.trim()) {
      toast.error('Címzett email cím kötelező')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to.trim())) {
      toast.error('Érvényes email cím szükséges')
      return
    }

    if (!subject || !subject.trim()) {
      toast.error('Tárgy kötelező')
      return
    }

    const html = editor?.getHTML() || ''
    // Check if body has content (remove empty paragraphs and whitespace)
    const textContent = editor?.getText() || ''
    if (!textContent.trim()) {
      toast.error('Email tartalom kötelező')
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          html: html,
          po_id: poId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Hiba az email küldésekor')
      }

      toast.success('Email sikeresen elküldve')
      
      // Clear form and close modal
      setTo('')
      setSubject('')
      if (editor) {
        editor.commands.clearContent()
      }
      handleClose()
    } catch (error: any) {
      toast.error(error.message || 'Hiba az email küldésekor')
      // Keep modal open on error
    } finally {
      setIsSending(false)
    }
  }

  const handleInsertTable = () => {
    if (!editor || poItems.length === 0) {
      toast.warning('Nincsenek tételek a beszúráshoz')
      return
    }

    // Create HTML numbered list with line breaks for email rendering
    let listHTML = ''
    poItems.forEach((item, index) => {
      const unitName = item.units?.shortform || item.units?.name || '-'
      const productName = item.description || '-'
      
      // Include SKU only for accessories (not for materials or linear_materials)
      // Make list number, quantity and unit bold by default
      if (item.product_type === 'accessory' && item.accessories?.sku) {
        listHTML += `<strong>${index + 1}.</strong> ${productName} - ${item.accessories.sku} - <strong>${item.quantity} - ${unitName}</strong><br>`
      } else {
        listHTML += `<strong>${index + 1}.</strong> ${productName} - <strong>${item.quantity} - ${unitName}</strong><br>`
      }
    })

    // Insert HTML with line breaks at cursor position
    editor.chain().focus().insertContent(listHTML).run()
    toast.success('Tételek beszúrva')
  }

  const handleInsertTemplate = () => {
    if (!editor || !partnerTemplate) {
      toast.warning('Nincs elérhető email sablon')
      return
    }

    // Insert template HTML at cursor position
    editor.chain().focus().insertContent(partnerTemplate).run()
    toast.success('Email sablon beszúrva')
  }

  const handleInsertSignature = () => {
    if (!editor || !signature) {
      toast.warning('Nincs elérhető aláírás')
      return
    }

    // Insert signature HTML at cursor position
    editor.chain().focus().insertContent(signature).run()
    toast.success('Aláírás beszúrva')
  }

  const handleRemoveSKUs = () => {
    if (!editor) {
      return
    }

    // Get current HTML content
    const currentHTML = editor.getHTML()
    
    // Pattern to match: number. Product Name - SKU - Quantity - Unit<br>
    // Format from code: `<strong>${index + 1}.</strong> ${productName} - ${item.accessories.sku} - <strong>${item.quantity} - ${unitName}</strong><br>`
    // We want to remove the SKU part (the second segment between dashes)
    // Note: List number and quantity/unit may be wrapped in <strong> tags
    
    // Strategy: Match lines that have the pattern with 4 segments where:
    // - Segment 1: List number (may be in <strong> tags) and product name
    // - Segment 2: SKU (what we want to remove)
    // - Segment 3: Quantity and unit (may be wrapped in <strong> tags together)
    
    // Regex pattern to handle both with and without <strong> tags:
    // (<strong>)?(\d+)\.(</strong>)?\s* - matches list number (optional bold: "<strong>1.</strong>" or "1.")
    // (.*?) - matches product name (non-greedy, stops at first " - ")
    // \s*-\s* - matches " - " separator
    // (.*?) - matches SKU (non-greedy, stops at next " - ")
    // \s*-\s* - matches " - " separator
    // (<strong>)? - optional opening <strong> tag for quantity/unit
    // (\d+(?:[.,]\d+)?\s*-\s*[^<]+) - matches "quantity - unit" (may include spaces)
    // (</strong>)? - optional closing </strong> tag
    const pattern = /(<strong>)?(\d+)\.(<\/strong>)?\s*(.*?)\s*-\s*(.*?)\s*-\s*(<strong>)?(\d+(?:[.,]\d+)?\s*-\s*[^<]+)(<\/strong>)?/g
    
    // Replace: keep list number (with bold if present) + product name, skip SKU, keep quantity and unit with bold tags
    const newHTML = currentHTML.replace(pattern, (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
      // p1 = "<strong>" or undefined (for list number)
      // p2 = "1" (list number)
      // p3 = "</strong>" or undefined (for list number)
      // p4 = "Product Name"
      // p5 = "SKU" (we skip this)
      // p6 = "<strong>" or undefined (for quantity/unit)
      // p7 = "Quantity - Unit" (e.g., "12 - db")
      // p8 = "</strong>" or undefined (for quantity/unit)
      const listBoldOpen = p1 || ''
      const listBoldClose = p3 || ''
      const qtyBoldOpen = p6 || ''
      const qtyBoldClose = p8 || ''
      return `${listBoldOpen}${p2}.${listBoldClose} ${p4} - ${qtyBoldOpen}${p7}${qtyBoldClose}`
    })
    
    // Update editor content
    editor.commands.setContent(newHTML)
    toast.success('SKU-k eltávolítva')
  }

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
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ ml: 2 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* To field */}
          <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
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

          {/* Subject field */}
          <Box sx={{ px: 3, pt: 1, pb: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Tárgy"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Box>

          {/* Rich text editor */}
          <Box sx={{ mt: 1.5 }}>
            <EditorToolbar 
              editor={editor} 
              onInsertTable={handleInsertTable}
              onInsertSignature={handleInsertSignature}
              hasSignature={!!signature}
              onInsertTemplate={handleInsertTemplate}
              hasTemplate={!!partnerTemplate}
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
              {loadingItems && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1
                }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <EditorContent editor={editor} />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
        >
          Mégse
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          startIcon={isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          disabled={isSending}
        >
          {isSending ? 'Küldés...' : 'Küldés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
