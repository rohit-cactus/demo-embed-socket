import { useRef, useCallback, useEffect, useState } from 'react'
import { Bold, Italic, Superscript, Subscript } from 'lucide-react'
import '../styles/RichTextEditor.css'

interface RichTextEditorProps {
  content: { html: string }
  onChange: (content: { html: string }) => void
  placeholder?: string
  minHeight?: number
}

const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Type here...',
  minHeight = 80,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())

  // Sync content from external changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content.html) {
      editorRef.current.innerHTML = content.html
    }
  }, [content.html])

  // Update active formats based on cursor position
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>()
    if (document.queryCommandState('bold')) formats.add('bold')
    if (document.queryCommandState('italic')) formats.add('italic')
    if (document.queryCommandState('subscript')) formats.add('subscript')
    if (document.queryCommandState('superscript')) formats.add('superscript')
    setActiveFormats(formats)
  }, [])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange({ html: editorRef.current.innerHTML })
      updateActiveFormats()
    }
  }, [onChange, updateActiveFormats])

  const handleSelectionChange = useCallback(() => {
    updateActiveFormats()
  }, [updateActiveFormats])

  // Listen for selection changes
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange])

  const execCommand = useCallback(
    (command: string) => {
      document.execCommand(command, false)
      editorRef.current?.focus()
      handleInput()
      updateActiveFormats()
    },
    [handleInput, updateActiveFormats]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault()
            execCommand('bold')
            break
          case 'i':
            e.preventDefault()
            execCommand('italic')
            break
        }
      }
    },
    [execCommand]
  )

  return (
    <div className="rich-text-editor-wrapper">
      {/* Toolbar */}
      <div className="rich-text-toolbar">
        <button
          type="button"
          className={`toolbar-btn ${activeFormats.has('bold') ? 'active' : ''}`}
          onClick={() => execCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeFormats.has('italic') ? 'active' : ''}`}
          onClick={() => execCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          className={`toolbar-btn ${activeFormats.has('subscript') ? 'active' : ''}`}
          onClick={() => execCommand('subscript')}
          title="Subscript"
        >
          <Subscript size={14} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeFormats.has('superscript') ? 'active' : ''}`}
          onClick={() => execCommand('superscript')}
          title="Superscript"
        >
          <Superscript size={14} />
        </button>
      </div>

      {/* Editable content area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="rich-text-content"
        data-placeholder={placeholder}
        style={{ minHeight: `${minHeight}px` }}
      />
    </div>
  )
}

export default RichTextEditor
