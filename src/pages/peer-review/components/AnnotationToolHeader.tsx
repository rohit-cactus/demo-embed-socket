/**
 * AnnotationToolHeader Component
 * Static, always-in-flow header pinned above the PDF viewport column.
 * Shows color, line style/width, opacity, and delete controls for the
 * active tool or the currently selected annotation — no floating/fixed
 * positioning, so it never drifts out of place when the PDF scrolls.
 */

import { useCallback } from 'react'
import { Trash2, Minus, Plus, Check, Underline, Strikethrough } from 'lucide-react'
import type { ColorOption, LineStyle, AnnotationToolId } from '../types'
import { COLOR_PALETTE, LINE_STYLES } from '../types'
import { getContrastingTextColor } from '../utils/styleUtils'

export interface AnnotationToolHeaderProps {
  annotationType: AnnotationToolId
  label?: string
  currentColor: string
  currentOpacity: number
  currentLineStyle: LineStyle
  currentLineWidth: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacityPercent: number) => void
  onLineStyleChange: (lineStyle: LineStyle) => void
  onLineWidthChange: (width: number) => void
  onDelete?: () => void
  onTextMarkupToggle?: (type: 'underline' | 'strikeout') => void
  isTextMarkup?: boolean
}

const Divider = () => <div className="h-6 w-px shrink-0 bg-paper-200" />

interface ColorSwatchProps {
  color: ColorOption
  isSelected: boolean
  onClick: () => void
}

const ColorSwatch = ({ color, isSelected, onClick }: ColorSwatchProps) => (
  <button
    type="button"
    onClick={onClick}
    title={color.label}
    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-paper-50 transition-shadow ${
      isSelected ? 'ring-ink-600' : 'ring-transparent hover:ring-paper-300'
    }`}
    style={{ backgroundColor: color.hex, color: getContrastingTextColor(color.hex) }}
  >
    {isSelected && <Check size={12} strokeWidth={3} />}
  </button>
)

interface LineStyleButtonProps {
  lineStyle: LineStyle
  label: string
  isSelected: boolean
  onClick: () => void
}

const LineStyleButton = ({ lineStyle, label, isSelected, onClick }: LineStyleButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
      isSelected
        ? 'border-ink-300 bg-ink-50 text-ink-700'
        : 'border-paper-200 text-paper-500 hover:bg-paper-100 hover:text-paper-700'
    }`}
  >
    <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
      <line
        x1="2"
        y1="7"
        x2="22"
        y2="7"
        strokeWidth="2"
        stroke="currentColor"
        strokeDasharray={lineStyle === 'dashed' ? '5,3.5' : lineStyle === 'dotted' ? '1.5,3' : undefined}
        strokeLinecap="round"
      />
    </svg>
  </button>
)

export const AnnotationToolHeader = ({
  annotationType,
  label,
  currentColor,
  currentOpacity,
  currentLineStyle,
  currentLineWidth,
  onColorChange,
  onOpacityChange,
  onLineStyleChange,
  onLineWidthChange,
  onDelete,
  onTextMarkupToggle,
  isTextMarkup = false,
}: AnnotationToolHeaderProps) => {
  const handleColorClick = useCallback(
    (color: ColorOption) => onColorChange(color.hex),
    [onColorChange]
  )

  const handleLineStyleClick = useCallback(
    (lineStyle: LineStyle) => onLineStyleChange(lineStyle),
    [onLineStyleChange]
  )

  const isShapeOrDrawing =
    annotationType === 'ink' ||
    annotationType === 'lineArrow' ||
    annotationType === 'square' ||
    annotationType === 'circle' ||
    annotationType === 'polygon'

  const canAdjustOpacity = isShapeOrDrawing || isTextMarkup

  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-paper-200 bg-white/90 px-4 py-2.5 font-ui backdrop-blur-sm">
      {label && (
        <span className="shrink-0 whitespace-nowrap rounded-full border border-ink-100 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-700">
          {label}
        </span>
      )}

      {label && <Divider />}

      {/* Color palette */}
      <div className="flex shrink-0 items-center gap-1.5">
        {COLOR_PALETTE.map((color) => (
          <ColorSwatch
            key={color.id}
            color={color}
            isSelected={currentColor === color.hex}
            onClick={() => handleColorClick(color)}
          />
        ))}
      </div>

      {/* Line style */}
      {isShapeOrDrawing && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center gap-1.5">
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
        </>
      )}

      {/* Line width */}
      {isShapeOrDrawing && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-paper-100 px-1 py-1">
            <button
              type="button"
              onClick={() => onLineWidthChange(Math.max(1, currentLineWidth - 1))}
              disabled={currentLineWidth <= 1}
              className="flex h-6 w-6 items-center justify-center rounded-full text-paper-600 transition-colors hover:bg-paper-200 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus size={13} />
            </button>
            <span className="w-5 text-center text-[13px] font-medium tabular-nums text-paper-700">
              {currentLineWidth}
            </span>
            <button
              type="button"
              onClick={() => onLineWidthChange(Math.min(20, currentLineWidth + 1))}
              disabled={currentLineWidth >= 20}
              className="flex h-6 w-6 items-center justify-center rounded-full text-paper-600 transition-colors hover:bg-paper-200 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus size={13} />
            </button>
          </div>
        </>
      )}

      {/* Opacity */}
      {canAdjustOpacity && (
        <>
          <Divider />
          <label className="flex shrink-0 items-center gap-2">
            <span className="w-9 text-[12px] font-medium tabular-nums text-paper-500">
              {currentOpacity}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={currentOpacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-paper-200 accent-ink-600"
            />
          </label>
        </>
      )}

      {/* Text markup toggles */}
      {isTextMarkup && onTextMarkupToggle && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onTextMarkupToggle('underline')}
              title="Underline"
              className="flex h-8 w-8 items-center justify-center rounded-md text-paper-500 transition-colors hover:bg-paper-100 hover:text-paper-700"
            >
              <Underline size={16} />
            </button>
            <button
              type="button"
              onClick={() => onTextMarkupToggle('strikeout')}
              title="Strikethrough"
              className="flex h-8 w-8 items-center justify-center rounded-md text-paper-500 transition-colors hover:bg-paper-100 hover:text-paper-700"
            >
              <Strikethrough size={16} />
            </button>
          </div>
        </>
      )}

      {/* Delete — only when an existing annotation is selected */}
      {onDelete && (
        <>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDelete}
            title="Delete annotation"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </>
      )}
    </div>
  )
}
