/**
 * ToolRail Component
 * Left sidebar with icon-only tool buttons for annotation tools
 */

import { useCallback } from 'react'
import {
  MousePointer,
  Pencil,
  ArrowRight,
  Square,
  Circle,
  Pentagon,
  Type,
  StickyNote,
  Highlighter,
  Underline,
  Strikethrough,
  ZoomIn,
  ZoomOut,
  Check,
} from 'lucide-react'
import type { AnnotationToolId, ColorOption, ToolConfig } from '../types'
import { TOOL_CONFIGS, COLOR_PALETTE } from '../types'
import { getContrastingTextColor } from '../utils/styleUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  MousePointer,
  Pencil,
  ArrowRight,
  Square,
  Circle,
  Pentagon,
  Type,
  StickyNote,
  Highlighter,
  Underline,
  Strikethrough,
}

export interface ToolRailProps {
  activeTool: AnnotationToolId | null
  onToolSelect: (tool: AnnotationToolId | null) => void
  onZoomIn: () => void
  onZoomOut: () => void
  zoomLevel: number
  canZoomIn: boolean
  canZoomOut: boolean
  selectedColor: ColorOption
  onColorSelect: (color: ColorOption) => void
  isAnnotationEditingEnabled: boolean
}

interface ToolButtonProps {
  tool: ToolConfig
  isActive: boolean
  isDisabled: boolean
  onClick: () => void
}

const ToolButton = ({ tool, isActive, isDisabled, onClick }: ToolButtonProps) => {
  const Icon = ICON_MAP[tool.icon]
  if (!Icon) return null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={`${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
        isActive
          ? 'bg-ink-700 text-white shadow-sm'
          : 'bg-paper-100 text-paper-600 hover:bg-paper-200 hover:text-paper-900'
      } ${isDisabled ? 'cursor-not-allowed opacity-40 hover:bg-paper-100' : ''}`}
    >
      <Icon size={18} />
    </button>
  )
}

const RailDivider = () => <div className="my-1 h-px w-8 shrink-0 bg-paper-200" />

export const ToolRail = ({
  activeTool,
  onToolSelect,
  onZoomIn,
  onZoomOut,
  zoomLevel,
  canZoomIn,
  canZoomOut,
  selectedColor,
  onColorSelect,
  isAnnotationEditingEnabled,
}: ToolRailProps) => {
  const handleToolClick = useCallback(
    (toolId: AnnotationToolId) => {
      if (activeTool === toolId) {
        onToolSelect(null)
      } else {
        onToolSelect(toolId)
      }
    },
    [activeTool, onToolSelect]
  )

  const selectionTools = TOOL_CONFIGS.filter((t) => t.category === 'selection')
  const drawingTools = TOOL_CONFIGS.filter((t) => t.category === 'drawing')
  const textMarkupTools = TOOL_CONFIGS.filter((t) => t.category === 'textMarkup')

  return (
    <aside className="flex w-20 shrink-0 items-center justify-center bg-paper-100 font-ui">
      <div className="flex  flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-paper-200 bg-white px-2 py-3 shadow-md shadow-paper-900/5 max-h-96 scroll-smooth no-scrollbar">
        {/* Zoom Controls */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onZoomIn}
            disabled={!canZoomIn}
            title="Zoom in"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-100 text-paper-600 transition-colors hover:bg-paper-200 hover:text-paper-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper-100"
          >
            <ZoomIn size={18} />
          </button>
          <div className="text-[10px] font-semibold tabular-nums text-paper-500">
            {Math.round(zoomLevel * 100)}%
          </div>
          <button
            type="button"
            onClick={onZoomOut}
            disabled={!canZoomOut}
            title="Zoom out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-100 text-paper-600 transition-colors hover:bg-paper-200 hover:text-paper-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper-100"
          >
            <ZoomOut size={18} />
          </button>
        </div>

        <RailDivider />

        {/* Selection Tool */}
        <div className="flex flex-col items-center gap-1">
          {selectionTools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              isDisabled={false}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>

        <RailDivider />

        {/* Drawing Tools */}
        <div className="flex flex-col items-center gap-1">
          {drawingTools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              isDisabled={!isAnnotationEditingEnabled}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>

        <RailDivider />

        {/* Text Markup Tools */}
        <div className="flex flex-col items-center gap-1">
          {textMarkupTools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              isDisabled={!isAnnotationEditingEnabled}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>

        <RailDivider />

        {/* Color Palette */}
        <div className="grid grid-cols-2 gap-1.5 py-0.5">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => onColorSelect(color)}
              title={color.label}
              className={`flex h-5.5 w-5.5 items-center justify-center rounded-full ring-2 ring-offset-1 ring-offset-white transition-shadow ${
                selectedColor.id === color.id ? 'ring-ink-600' : 'ring-transparent hover:ring-paper-300'
              }`}
              style={{ backgroundColor: color.hex, color: getContrastingTextColor(color.hex) }}
            >
              {selectedColor.id === color.id && <Check size={10} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
