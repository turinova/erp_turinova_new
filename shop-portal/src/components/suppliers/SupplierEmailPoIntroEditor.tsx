'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Paper } from '@mui/material'
import '@/libs/styles/tiptapEditor.css'

type Props = {
  initialContent: string
  onHtmlChange: (html: string) => void
}

/**
 * Rich-text intro for PO e-mail (supplier-level), used inside order-channel dialog for type e-mail.
 * Parent should set key={...} when dialog opens so content resets from server.
 */
export default function SupplierEmailPoIntroEditor({ initialContent, onHtmlChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Pl. Tisztelt Partnerünk! …'
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] })
    ],
    content: initialContent || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-inner',
        style: 'min-height:160px;outline:none;padding:12px;'
      }
    },
    onUpdate: ({ editor: ed }) => onHtmlChange(ed.getHTML())
  })

  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'rgba(0, 0, 0, 0.02)'
      }}
    >
      <EditorContent editor={editor} />
    </Paper>
  )
}
