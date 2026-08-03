import { useState } from 'react'
import { AnnotationTool } from '../types/annotations'
import '../styles/Toolbar.css'

interface ToolbarProps {
  activeTool: AnnotationTool
  setActiveTool: (tool: AnnotationTool) => void
  isReadOnly: boolean
}

const HIGHLIGHT_COLORS = ['#FFFF00', '#00FF00', '#FF00FF', '#00FFFF']
const INK_COLORS = ['#000000', '#FF0000', '#0000FF', '#00FF00']
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32]
const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana']

const Toolbar = ({ activeTool, setActiveTool, isReadOnly }: ToolbarProps) => {
  const [showTextOptions, setShowTextOptions] = useState(false)
  const [showInkOptions, setShowInkOptions] = useState(false)
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [inkColor, setInkColor] = useState(INK_COLORS[0])
  const [inkWidth, setInkWidth] = useState(2)
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0])

  const handleToolClick = (tool: AnnotationTool) => {
    if (isReadOnly) return

    if (tool === 'text') {
      setShowTextOptions(!showTextOptions)
      setShowInkOptions(false)
    } else if (tool === 'ink') {
      setShowInkOptions(!showInkOptions)
      setShowTextOptions(false)
    } else {
      setShowTextOptions(false)
      setShowInkOptions(false)
    }

    setActiveTool(activeTool === tool ? null : tool)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        {/* Zoom controls */}
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            title="Zoom In"
            onClick={() => {
              // These would connect to the PDF viewer zoom API
              console.log('Zoom in')
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            className="toolbar-btn"
            title="Zoom Out"
            onClick={() => {
              console.log('Zoom out')
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text selection annotations */}
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${activeTool === 'highlight' ? 'active' : ''}`}
            title="Highlight Text"
            onClick={() => handleToolClick('highlight')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill={activeTool === 'highlight' ? highlightColor : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M15.5 4l-8 8 4 4 8-8-4-4z" />
              <path d="M7.5 12l-3 7 7-3" />
            </svg>
          </button>

          <button
            className={`toolbar-btn ${activeTool === 'underline' ? 'active' : ''}`}
            title="Underline Text"
            onClick={() => handleToolClick('underline')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
              <line x1="4" y1="21" x2="20" y2="21" />
            </svg>
          </button>

          <button
            className={`toolbar-btn ${activeTool === 'strikeout' ? 'active' : ''}`}
            title="Strike Through"
            onClick={() => handleToolClick('strikeout')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text tool (free text annotation) */}
        <div className="toolbar-group relative">
          <button
            className={`toolbar-btn ${activeTool === 'text' ? 'active' : ''}`}
            title="Add Text"
            onClick={() => handleToolClick('text')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </button>

          {showTextOptions && (
            <div className="tool-options-popup">
              <div className="option-group">
                <label>Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div className="option-group">
                <label>Font Size</label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Note/Sticky note annotation */}
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${activeTool === 'note' ? 'active' : ''}`}
            title="Add Note"
            onClick={() => handleToolClick('note')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill={activeTool === 'note' ? '#FFD700' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Ink/Freehand drawing */}
        <div className="toolbar-group relative">
          <button
            className={`toolbar-btn ${activeTool === 'ink' ? 'active' : ''}`}
            title="Draw"
            onClick={() => handleToolClick('ink')}
            disabled={isReadOnly}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={inkColor} strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          </button>

          {showInkOptions && (
            <div className="tool-options-popup">
              <div className="option-group">
                <label>Color</label>
                <div className="color-picker">
                  {INK_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${inkColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setInkColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="option-group">
                <label>Line Width: {inkWidth}px</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={inkWidth}
                  onChange={(e) => setInkWidth(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Color options for highlight */}
      {activeTool === 'highlight' && (
        <div className="color-bar">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              className={`color-swatch ${highlightColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setHighlightColor(color)}
              title={`Highlight with ${color}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Toolbar
