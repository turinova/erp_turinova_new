'use client'

import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, IconButton, Divider } from '@mui/material'
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

// Editor Toolbar Component
const EditorToolbar = ({ 
  editor, 
  isSourceMode, 
  onToggleSourceMode 
}: { 
  editor: Editor | null
  isSourceMode: boolean
  onToggleSourceMode: () => void
}) => {
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
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={onToggleSourceMode}
        color={isSourceMode ? 'primary' : 'default'}
        sx={{ 
          border: 1, 
          borderColor: isSourceMode ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title={isSourceMode ? 'Vissza a szerkesztőhöz' : 'HTML forráskód megjelenítése'}
      >
        <CodeIcon fontSize="small" />
      </IconButton>
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
  const [isSourceMode, setIsSourceMode] = useState(false)
  const [sourceCode, setSourceCode] = useState(value || '')

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
      if (!isSourceMode) {
        onChange(editor.getHTML())
      }
    },
  })

  // Update editor content when value prop changes (but not from user input)
  useEffect(() => {
    if (editor && value !== undefined && !isSourceMode) {
      const currentHtml = editor.getHTML()
      // Only update if the value actually changed (avoid infinite loops)
      if (currentHtml !== value) {
        editor.commands.setContent(value || '')
      }
    }
  }, [editor, value, isSourceMode])

  // Sync sourceCode with value when entering source mode
  useEffect(() => {
    if (isSourceMode) {
      setSourceCode(value || '')
    }
  }, [isSourceMode, value])

  const handleToggleSourceMode = () => {
    if (isSourceMode) {
      // Switching from source mode to visual mode
      // Update the editor with the source code
      if (editor) {
        editor.commands.setContent(sourceCode || '')
        onChange(sourceCode || '')
      }
    }
    setIsSourceMode(!isSourceMode)
  }

  const handleSourceCodeChange = (newSourceCode: string) => {
    setSourceCode(newSourceCode)
    onChange(newSourceCode)
  }

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
        {isSourceMode ? (
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                HTML forráskód
              </Typography>
              <IconButton
                size="small"
                onClick={handleToggleSourceMode}
                color="primary"
                sx={{ 
                  border: 1, 
                  borderColor: 'primary.main',
                  borderRadius: 1
                }}
                title="Vissza a szerkesztőhöz"
              >
                <CodeIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                p: 1
              }}
            >
              <Box
                component="textarea"
                value={sourceCode}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleSourceCodeChange(e.target.value)}
                placeholder={placeholder}
                sx={{
                  width: '100%',
                  minHeight: `${height - 150}px`,
                  maxHeight: `${height - 150}px`,
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  padding: '12px',
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  backgroundColor: 'transparent',
                  font: 'inherit',
                  color: 'inherit'
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box>
            <EditorToolbar 
              editor={editor} 
              isSourceMode={isSourceMode}
              onToggleSourceMode={handleToggleSourceMode}
            />
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
        )}
      </Paper>
    </Box>
  )
}
