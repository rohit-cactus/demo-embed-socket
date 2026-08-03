import { useState, useRef, useEffect, useCallback } from 'react'
import { Annotation, AnnotationTool, RichContent } from '../types/annotations'
import '../styles/AnnotationLayer.css'

interface AnnotationLayerProps {
  annotations: Annotation[]
  activeTool: AnnotationTool
  selectedAnnotation: string | null
  setSelectedAnnotation: (id: string | null) => void
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'author' | 'createdAt' | 'comments'>) => void
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  isReadOnly: boolean
}

const AnnotationLayer = ({
  annotations,
  activeTool,
  selectedAnnotation,
  setSelectedAnnotation,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  isReadOnly,
}: AnnotationLayerProps) => {
  const [isDrawing, setIsDrawing] = useState(false)
  const [inkPoints, setInkPoints] = useState<Array<{ x: number; y: number }>>([])
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [notePosition, setNotePosition] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)

  const handleLayerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!layerRef.current || isReadOnly || !activeTool) return

      const rect = layerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (activeTool === 'text') {
        setTextPosition({ x, y })
        setNotePosition(null)
      } else if (activeTool === 'note') {
        setNotePosition({ x, y })
        setTextPosition(null)
      }
    },
    [activeTool, isReadOnly]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!layerRef.current || isReadOnly || activeTool !== 'ink') return

      const rect = layerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setIsDrawing(true)
      setInkPoints([{ x, y }])
    },
    [activeTool, isReadOnly]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !layerRef.current || activeTool !== 'ink') return

      const rect = layerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setInkPoints((prev) => [...prev, { x, y }])
    },
    [isDrawing, activeTool]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || inkPoints.length < 2) {
      setIsDrawing(false)
      return
    }

    // Create ink annotation
    addAnnotation({
      documentId: 'sample',
      pageIndex: 0,
      type: 'ink',
      inkPoints,
      color: '#000000',
    })

    setIsDrawing(false)
    setInkPoints([])
  }, [isDrawing, inkPoints, addAnnotation])

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim() || !textPosition) return

    addAnnotation({
      documentId: 'sample',
      pageIndex: 0,
      type: 'text',
      position: textPosition,
      textContent: {
        blocks: [{ type: 'paragraph', content: textInput }],
      },
    })

    setTextInput('')
    setTextPosition(null)
  }, [textInput, textPosition, addAnnotation])

  const handleNoteSubmit = useCallback(() => {
    if (!noteInput.trim() || !notePosition) return

    addAnnotation({
      documentId: 'sample',
      pageIndex: 0,
      type: 'note',
      position: notePosition,
      textContent: {
        blocks: [{ type: 'paragraph', content: noteInput }],
      },
    })

    setNoteInput('')
    setNotePosition(null)
  }, [noteInput, notePosition, addAnnotation])

  const getAnnotationStyle = (annotation: Annotation): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      cursor: 'pointer',
    }

    if (annotation.rect) {
      return {
        ...baseStyle,
        left: annotation.rect.x,
        top: annotation.rect.y,
        width: annotation.rect.width,
        height: annotation.rect.height,
      }
    }

    if (annotation.position) {
      return {
        ...baseStyle,
        left: annotation.position.x,
        top: annotation.position.y,
      }
    }

    return baseStyle
  }

  const renderAnnotation = (annotation: Annotation) => {
    const isSelected = selectedAnnotation === annotation.id

    switch (annotation.type) {
      case 'highlight':
        return (
          <div
            key={annotation.id}
            className={`annotation-highlight ${isSelected ? 'selected' : ''}`}
            style={{
              ...getAnnotationStyle(annotation),
              backgroundColor: annotation.color || '#FFFF00',
              opacity: 0.4,
            }}
            onClick={() => setSelectedAnnotation(annotation.id)}
          />
        )

      case 'underline':
        return (
          <div
            key={annotation.id}
            className={`annotation-underline ${isSelected ? 'selected' : ''}`}
            style={{
              ...getAnnotationStyle(annotation),
              borderBottom: `2px solid ${annotation.color || '#FF0000'}`,
            }}
            onClick={() => setSelectedAnnotation(annotation.id)}
          />
        )

      case 'strikeout':
        return (
          <div
            key={annotation.id}
            className={`annotation-strikeout ${isSelected ? 'selected' : ''}`}
            style={{
              ...getAnnotationStyle(annotation),
              textDecoration: 'line-through',
              textDecorationColor: annotation.color || '#FF0000',
            }}
            onClick={() => setSelectedAnnotation(annotation.id)}
          />
        )

      case 'note':
        return (
          <div
            key={annotation.id}
            className={`annotation-note ${isSelected ? 'selected' : ''}`}
            style={getAnnotationStyle(annotation)}
            onClick={() => setSelectedAnnotation(annotation.id)}
          >
            📝
          </div>
        )

      case 'text':
        return (
          <div
            key={annotation.id}
            className={`annotation-text ${isSelected ? 'selected' : ''}`}
            style={getAnnotationStyle(annotation)}
            onClick={() => setSelectedAnnotation(annotation.id)}
          >
            {annotation.textContent?.blocks.map((block, idx) => (
              <p key={idx}>{block.content}</p>
            ))}
          </div>
        )

      case 'ink':
        if (!annotation.inkPoints || annotation.inkPoints.length < 2) return null
        const pathD = annotation.inkPoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ')
        return (
          <svg
            key={annotation.id}
            className={`annotation-ink ${isSelected ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <path
              d={pathD}
              fill="none"
              stroke={annotation.color || '#000000'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )

      default:
        return null
    }
  }

  // Render current drawing
  const renderInkPreview = () => {
    if (!isDrawing || inkPoints.length < 2) return null

    const pathD = inkPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    return (
      <svg
        className="ink-preview"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="#000000"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <div
      ref={layerRef}
      className={`annotation-layer ${activeTool ? `active-tool-${activeTool}` : ''}`}
      onClick={handleLayerClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Render existing annotations */}
      {annotations.map(renderAnnotation)}

      {/* Render current drawing preview */}
      {renderInkPreview()}

      {/* Text input popup */}
      {textPosition && (
        <div
          className="text-input-popup"
          style={{ left: textPosition.x, top: textPosition.y }}
        >
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text..."
            autoFocus
          />
          <div className="popup-actions">
            <button onClick={handleTextSubmit}>Add</button>
            <button onClick={() => setTextPosition(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Note input popup */}
      {notePosition && (
        <div
          className="note-input-popup"
          style={{ left: notePosition.x, top: notePosition.y }}
        >
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Enter note..."
            autoFocus
          />
          <div className="popup-actions">
            <button onClick={handleNoteSubmit}>Add</button>
            <button onClick={() => setNotePosition(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnnotationLayer
