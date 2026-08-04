/**
 * AnnotationToolHeader Component
 * Static, always-in-flow header pinned above the PDF viewport column.
 * Shows color, opacity, and delete controls for the active tool or the
 * currently selected annotation — no floating/fixed positioning, so it
 * never drifts out of place when the PDF scrolls.
 */

import { useCallback } from 'react'
import { Trash2, Check, Underline, Strikethrough } from 'lucide-react'
import type { ColorOption, AnnotationToolId } from '../types'
import { COLOR_PALETTE } from '../types'
import { getContrastingTextColor } from '../utils/styleUtils'

export interface AnnotationToolHeaderProps {
  annotationType: AnnotationToolId
  label?: string
  currentColor: string
  currentOpacity: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacityPercent: number) => void
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

export const AnnotationToolHeader = ({
  annotationType,
  label,
  currentColor,
  currentOpacity,
  onColorChange,
  onOpacityChange,
  onDelete,
  onTextMarkupToggle,
  isTextMarkup = false,
}: AnnotationToolHeaderProps) => {
  const handleColorClick = useCallback(
    (color: ColorOption) => onColorChange(color.hex),
    [onColorChange]
  )

  const isShapeOrDrawing =
    annotationType === 'ink' ||
    annotationType === 'lineArrow' ||
    annotationType === 'square' ||
    annotationType === 'circle' ||
    annotationType === 'polygon'

  const canAdjustOpacity = isShapeOrDrawing || isTextMarkup

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-paper-200 bg-white/90 px-4 font-ui backdrop-blur-sm">
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
