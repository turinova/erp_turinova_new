'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Divider,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  StrikethroughS as StrikeIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  FormatAlignJustify as AlignJustifyIcon,
  TableChart as TableIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as OrderedListIcon,
  Code as CodeIcon,
  Title as TitleIcon
} from '@mui/icons-material'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/core'
import '@/libs/styles/tiptapEditor.css'

export type EditorMode = 'visual' | 'html'

function EditorToolbar({
  editor,
  disabled,
  onInsertTable
}: {
  editor: Editor | null
  disabled: boolean
  onInsertTable: () => void
}) {
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
        bgcolor: 'action.hover',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
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
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        color={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('heading', { level: 2 }) ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
        title="Címsor"
      >
        <TitleIcon fontSize="small" />
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
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        color={editor.isActive('bulletList') ? 'primary' : 'default'}
        sx={{
          border: 1,
          borderColor: editor.isActive('bulletList') ? 'primary.main' : 'divider',
          borderRadius: 1
        }}
      >
        <BulletListIcon fontSize="small" />
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
      >
        <OrderedListIcon fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={onInsertTable}
        color="primary"
        sx={{ border: 1, borderColor: 'primary.main', borderRadius: 1 }}
        title="Táblázat beszúrása"
      >
        <TableIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

type Props = {
  /** HTML body (sanitized on save server-side) */
  html: string
  onHtmlChange: (html: string) => void
}

export default function OrderStatusTemplateRichEditor({ html, onHtmlChange }: Props) {
  const [mode, setMode] = useState<EditorMode>('visual')
  const [htmlSource, setHtmlSource] = useState(html)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }
      }),
      Underline,
      Placeholder.configure({ placeholder: 'E-mail szövegtörzs…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: html || '<p></p>',
    onUpdate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML())
    },
    immediatelyRender: false
  })

  useEffect(() => {
    setHtmlSource(html)
    if (editor && mode === 'visual') {
      const cur = editor.getHTML()
      if (cur !== html) {
        editor.commands.setContent(html || '<p></p>', { emitUpdate: false })
      }
    }
  }, [html, editor, mode])

  const handleModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, next: EditorMode | null) => {
      if (next === null || !editor) return
      if (next === 'html' && mode === 'visual') {
        setHtmlSource(editor.getHTML())
        setMode('html')
        return
      }
      if (next === 'visual' && mode === 'html') {
        try {
          editor.commands.setContent(htmlSource || '<p></p>', { emitUpdate: false })
          onHtmlChange(editor.getHTML())
        } catch {
          editor.commands.setContent('<p></p>', { emitUpdate: false })
          onHtmlChange(editor.getHTML())
        }
        setMode('visual')
      }
    },
    [editor, mode, htmlSource, onHtmlChange]
  )

  const onInsertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CodeIcon sx={{ fontSize: 16 }} />
          Szöveges nézet és nyers HTML váltása
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(e, v) => handleModeChange(e, v as EditorMode | null)}
        >
          <ToggleButton value="visual">Szöveg</ToggleButton>
          <ToggleButton value="html">HTML forráskód</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'visual' ? (
        <Box>
          <EditorToolbar editor={editor} disabled={false} onInsertTable={onInsertTable} />
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderTop: 0,
              borderRadius: '0 0 8px 8px',
              minHeight: 320,
              maxHeight: 420,
              overflow: 'auto',
              '& .ProseMirror': {
                minHeight: 300,
                fontSize: '14px',
                p: 2,
                outline: 'none'
              },
              '& .ProseMirror table': {
                borderCollapse: 'collapse',
                width: '100%',
                margin: '12px 0'
              },
              '& .ProseMirror table td, & .ProseMirror table th': {
                border: '1px solid #ddd',
                padding: '8px'
              },
              '& .ProseMirror table th': {
                backgroundColor: '#f5f5f5',
                fontWeight: 600
              }
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        </Box>
      ) : (
        <TextField
          fullWidth
          multiline
          minRows={14}
          maxRows={24}
          value={htmlSource}
          onChange={(e) => {
            const v = e.target.value
            setHtmlSource(v)
            onHtmlChange(v)
          }}
          placeholder="<p>…</p>"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            '& textarea': { fontSize: 13 }
          }}
        />
      )}
    </Box>
  )
}
