/**
 * ContextualToolbar Component
 * Floating toolbar that appears above a selected annotation
 * Provides color, line style, and delete options
 */

import { useCallback } from 'react'
import { Trash2, Minus, Plus } from 'lucide-react'
import type { ColorOption, LineStyle, AnnotationToolId } from '../types'
import { COLOR_PALETTE, LINE_STYLES } from '../types'
import { getContrastingTextColor } from '../utils/styleUtils'

export interface ContextualToolbarProps {
  annotationType: AnnotationToolId
  currentColor: string
  currentOpacity: number
  currentLineStyle: LineStyle
  currentLineWidth: number
  position: { x: number; y: number }
  onColorChange: (color: string) => void
  onOpacityChange: (opacityPercent: number) => void
  onLineStyleChange: (lineStyle: LineStyle) => void
  onLineWidthChange: (width: number) => void
  onDelete: () => void
  onTextMarkupToggle?: (type: 'underline' | 'strikeout') => void
  isTextMarkup?: boolean
}

interface ColorSwatchProps {
  color: ColorOption
  isSelected: boolean
  onClick: () => void
}

const ColorSwatch = ({ color, isSelected, onClick }: ColorSwatchProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`contextual-toolbar-color-swatch ${isSelected ? 'selected' : ''}`}
      style={{
        backgroundColor: color.hex,
        color: getContrastingTextColor(color.hex),
      }}
      title={color.label}
    >
      {isSelected && <span>✓</span>}
    </button>
  )
}

interface LineStyleButtonProps {
  lineStyle: LineStyle
  label: string
  isSelected: boolean
  onClick: () => void
}

const LineStyleButton = ({ lineStyle, label, isSelected, onClick }: LineStyleButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`contextual-toolbar-line-style ${isSelected ? 'selected' : ''}`}
      title={label}
    >
      <svg width="32" height="16" viewBox="0 0 32 16" className="line-style-preview">
        {lineStyle === 'solid' && (
          <line x1="2" y1="8" x2="30" y2="8" strokeWidth="2" stroke="currentColor" />
        )}
        {lineStyle === 'dashed' && (
          <line x1="2" y1="8" x2="30" y2="8" strokeWidth="2" stroke="currentColor" strokeDasharray="6,4" />
        )}
        {lineStyle === 'dotted' && (
          <line x1="2" y1="8" x2="30" y2="8" strokeWidth="2" stroke="currentColor" strokeDasharray="2,2" />
        )}
      </svg>
    </button>
  )
}

export const ContextualToolbar = ({
  annotationType,
  currentColor,
  currentOpacity,
  currentLineStyle,
  currentLineWidth,
  position,
  onColorChange,
  onOpacityChange,
  onLineStyleChange,
  onLineWidthChange,
  onDelete,
  onTextMarkupToggle,
  isTextMarkup = false,
}: ContextualToolbarProps) => {
  const handleColorClick = useCallback(
    (color: ColorOption) => {
      onColorChange(color.hex)
    },
    [onColorChange]
  )

  const handleLineStyleClick = useCallback(
    (lineStyle: LineStyle) => {
      onLineStyleChange(lineStyle)
    },
    [onLineStyleChange]
  )

  const isShapeOrDrawing = annotationType === 'ink' ||
    annotationType === 'lineArrow' ||
    annotationType === 'square' ||
    annotationType === 'circle' ||
    annotationType === 'polygon'

  const canAdjustOpacity = isShapeOrDrawing || isTextMarkup

  return (
    <div
      className="contextual-toolbar"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Color Palette */}
      <div className="contextual-toolbar-section">
        <div className="contextual-toolbar-colors">
          {COLOR_PALETTE.map((color) => (
            <ColorSwatch
              key={color.id}
              color={color}
              isSelected={currentColor === color.hex}
              onClick={() => handleColorClick(color)}
            />
          ))}
        </div>
      </div>

      {/* Line Style (only for shapes/drawings) */}
      {isShapeOrDrawing && (
        <div className="contextual-toolbar-section">
          <div className="contextual-toolbar-divider-v" />
          <div className="contextual-toolbar-line-styles">
          {LINE_STYLES.map((ls) => (
            <LineStyleButton
              key={ls.id}
              lineStyle={ls.id}
              label={ls.label}
              isSelected={currentLineStyle === ls.id}
              onClick={() => handleLineStyleClick(ls.id)}
            />
          ))}
          </div>
        </div>
      )}

      {/* Line Width (only for shapes/drawings) */}
      {isShapeOrDrawing && (
        <div className="contextual-toolbar-section">
          <div className="contextual-toolbar-divider-v" />
          <div className="contextual-toolbar-line-width">
            <button
              type="button"
              onClick={() => onLineWidthChange(Math.max(1, currentLineWidth - 1))}
              className="line-width-btn"
              disabled={currentLineWidth <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="line-width-value">{currentLineWidth}</span>
            <button
              type="button"
              onClick={() => onLineWidthChange(Math.min(20, currentLineWidth + 1))}
              className="line-width-btn"
              disabled={currentLineWidth >= 20}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Opacity (for shapes/drawings and text markup) */}
      {canAdjustOpacity && (
        <div className="contextual-toolbar-section">
          <div className="contextual-toolbar-divider-v" />
          <label className="contextual-toolbar-opacity">
            <span className="contextual-toolbar-opacity-label">{currentOpacity}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={currentOpacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="contextual-toolbar-opacity-slider"
            />
          </label>
        </div>
      )}

      {/* Text Markup Toggles (only for highlight) */}
      {isTextMarkup && onTextMarkupToggle && (
        <div className="contextual-toolbar-section">
          <div className="contextual-toolbar-divider-v" />
          <div className="contextual-toolbar-text-markup">
            <button
              type="button"
              onClick={() => onTextMarkupToggle('underline')}
              className="text-markup-btn"
              title="Underline"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <text x="10" y="14" textAnchor="middle" fontSize="12" fill="currentColor">U</text>
                <line x1="4" y1="17" x2="16" y2="17" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onTextMarkupToggle('strikeout')}
              className="text-markup-btn"
              title="Strikethrough"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <text x="10" y="14" textAnchor="middle" fontSize="12" fill="currentColor" textDecoration="line-through">S</text>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete */}
      <div className="contextual-toolbar-section">
        <div className="contextual-toolbar-divider-v" />
        <button
          type="button"
          onClick={onDelete}
          className="contextual-toolbar-delete"
          title="Delete annotation"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}
