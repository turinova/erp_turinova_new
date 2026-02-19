'use client'

import React, { useEffect } from 'react'
import { Box, Typography, Paper, Tabs, Tab, IconButton, Divider } from '@mui/material'
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  StrikethroughS as StrikeIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  FormatAlignJustify as AlignJustifyIcon,
  FormatListBulleted as ListBulletedIcon,
  FormatListNumbered as ListNumberedIcon,
  FormatQuote as QuoteIcon,
  Code as CodeIcon,
  Undo as UndoIcon,
  Redo as RedoIcon
} from '@mui/icons-material'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import '@/libs/styles/tiptapEditor.css'

interface HtmlEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  height?: number
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`html-editor-tabpanel-${index}`}
      aria-labelledby={`html-editor-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

// Editor Toolbar Component
const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        p: 1,
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
        title="Félkövér"
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
        title="Dőlt"
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
        title="Aláhúzott"
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
        title="Áthúzott"
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
        title="Balra igazítás"
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
        title="Középre igazítás"
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
        title="Jobbra igazítás"
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
        title="Sorkizárt"
      >
        <AlignJustifyIcon fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        color={editor.isActive('bulletList') ? 'primary' : 'default'}
        sx={{ 
          border: 1, 
          borderColor: editor.isActive('bulletList') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title="Felsorolás"
      >
        <ListBulletedIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        color={editor.isActive('orderedList') ? 'primary' : 'default'}
        sx={{ 
          border: 1, 
          borderColor: editor.isActive('orderedList') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title="Számozott lista"
      >
        <ListNumberedIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        color={editor.isActive('blockquote') ? 'primary' : 'default'}
        sx={{ 
          border: 1, 
          borderColor: editor.isActive('blockquote') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title="Idézet"
      >
        <QuoteIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().toggleCode().run()}
        color={editor.isActive('code') ? 'primary' : 'default'}
        sx={{ 
          border: 1, 
          borderColor: editor.isActive('code') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title="Kód"
      >
        <CodeIcon fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        sx={{ 
          border: 1, 
          borderColor: 'divider',
          borderRadius: 1
        }}
        title="Visszavonás"
      >
        <UndoIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        sx={{ 
          border: 1, 
          borderColor: 'divider',
          borderRadius: 1
        }}
        title="Újra"
      >
        <RedoIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

export default function HtmlEditor({
  value,
  onChange,
  label,
  placeholder = 'Írjon be szöveget...',
  height = 400
}: HtmlEditorProps) {
  const [tabValue, setTabValue] = React.useState(0)

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit, // Includes basic formatting (bold, italic, strike, etc.)
      Placeholder.configure({
        placeholder: placeholder
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Update editor content when value prop changes (but not from user input)
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHtml = editor.getHTML()
      // Only update if the value actually changed (avoid infinite loops)
      if (currentHtml !== value) {
        editor.commands.setContent(value || '')
      }
    }
  }, [editor, value])

  if (!editor) {
    return null
  }

  return (
    <Box>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
      )}
      <Paper variant="outlined">
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Szerkesztés" />
          <Tab label="Előnézet" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box>
            <EditorToolbar editor={editor} />
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                minHeight: height - 150,
                maxHeight: height - 150,
                overflow: 'auto'
              }}
            >
              <EditorContent editor={editor} />
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box
            sx={{
              minHeight: height - 100,
              maxHeight: height - 100,
              overflow: 'auto',
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper'
            }}
          >
            {value ? (
              <Box
                dangerouslySetInnerHTML={{ __html: value }}
                sx={{
                  '& img': {
                    maxWidth: '100%',
                    height: 'auto'
                  },
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%'
                  },
                  '& td, & th': {
                    border: '1px solid #ddd',
                    padding: '8px'
                  }
                }}
              />
            ) : (
              <Typography color="text.secondary" variant="body2">
                Nincs tartalom az előnézethez
              </Typography>
            )}
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  )
}
