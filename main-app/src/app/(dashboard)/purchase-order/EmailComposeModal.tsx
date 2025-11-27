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
  DeleteOutline as DeleteRowIcon,
  DeleteSweep as DeleteTableIcon
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
  isInTable
}: { 
  editor: Editor | null
  onInsertTable: () => void
  isInTable: boolean
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
      {isInTable && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <IconButton
            size="small"
            onClick={() => {
              try {
                editor.chain().focus().deleteRow().run()
              } catch (error) {
                toast.error('Nem lehet törölni ezt a sort')
              }
            }}
            color="error"
            sx={{ 
              border: 1, 
              borderColor: 'error.main',
              borderRadius: 1
            }}
            title="Sor törlése"
          >
            <DeleteRowIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              try {
                editor.chain().focus().deleteTable().run()
              } catch (error) {
                toast.error('Nem lehet törölni ezt a táblázatot')
              }
            }}
            color="error"
            sx={{ 
              border: 1, 
              borderColor: 'error.main',
              borderRadius: 1
            }}
            title="Táblázat törlése"
          >
            <DeleteTableIcon fontSize="small" />
          </IconButton>
        </>
      )}
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
  const [isInTable, setIsInTable] = useState(false)

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
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Update table state for button visibility
      setIsInTable(editor.isActive('table') || editor.isActive('tableCell') || editor.isActive('tableRow'))
    },
    onSelectionUpdate: ({ editor }) => {
      // Update table state when selection changes
      setIsInTable(editor.isActive('table') || editor.isActive('tableCell') || editor.isActive('tableRow'))
    }
  })

  // Fetch purchase order items when modal opens
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
      fetchItems()
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

  const handleClose = () => {
    if (!open) return
    onClose()
  }

  const handleSend = () => {
    // TODO: Implement email sending functionality
    const body = editor?.getHTML() || ''
    console.log('Send email:', { to, subject, body })
    handleClose()
  }

  const handleInsertTable = () => {
    if (!editor || poItems.length === 0) {
      toast.warning('Nincsenek tételek a beszúráshoz')
      return
    }

    // Create table HTML
    let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">'
    
    // Header row
    tableHTML += '<thead><tr style="background-color: #f5f5f5;">'
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Termék neve</th>'
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">SKU</th>'
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Mennyiség</th>'
    tableHTML += '<th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Mértékegység</th>'
    tableHTML += '</tr></thead>'
    
            // Body rows
            tableHTML += '<tbody>'
            poItems.forEach((item) => {
              const unitName = item.units?.shortform || item.units?.name || '-'
              // Extract SKU only for accessories (materials and linear_materials don't have SKU)
              const sku = (item.product_type === 'accessory' && item.accessories?.sku) ? item.accessories.sku : '-'
              
              tableHTML += '<tr>'
              tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${item.description || '-'}</td>`
              tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${sku}</td>`
              tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.quantity}</td>`
              tableHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${unitName}</td>`
              tableHTML += '</tr>'
            })
            tableHTML += '</tbody></table>'

    // Insert table into editor
    editor.chain().focus().insertContent(tableHTML).run()
    toast.success('Táblázat beszúrva')
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
              isInTable={isInTable}
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
          startIcon={<SendIcon />}
        >
          Küldés
        </Button>
      </DialogActions>
    </Dialog>
  )
}
