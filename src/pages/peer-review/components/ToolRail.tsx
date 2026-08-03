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
} from 'lucide-react'
import type { AnnotationToolId, ColorOption, ToolConfig } from '../types'
import { TOOL_CONFIGS, COLOR_PALETTE } from '../types'

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
      className={`tool-rail-button ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
    >
      <Icon size={20} />
    </button>
  )
}

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
    <aside className="tool-rail">
      {/* Zoom Controls */}
      <div className="tool-rail-section">
        <button
          type="button"
          onClick={onZoomOut}
          disabled={!canZoomOut}
          title="Zoom out"
          className="tool-rail-button"
        >
          <ZoomOut size={20} />
        </button>
        <div className="tool-rail-zoom-label">
          {Math.round(zoomLevel * 100)}%
        </div>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={!canZoomIn}
          title="Zoom in"
          className="tool-rail-button"
        >
          <ZoomIn size={20} />
        </button>
      </div>

      <div className="tool-rail-divider" />

      {/* Selection Tool */}
      <div className="tool-rail-section">
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

      <div className="tool-rail-divider" />

      {/* Drawing Tools */}
      <div className="tool-rail-section">
        <div className="tool-rail-section-label">Draw</div>
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

      <div className="tool-rail-divider" />

      {/* Text Markup Tools */}
      <div className="tool-rail-section">
        <div className="tool-rail-section-label">Markup</div>
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

      <div className="tool-rail-divider" />

      {/* Color Palette */}
      <div className="tool-rail-section">
        <div className="tool-rail-section-label">Color</div>
        <div className="tool-rail-color-grid">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => onColorSelect(color)}
              title={color.label}
              className={`tool-rail-color-swatch ${selectedColor.id === color.id ? 'selected' : ''}`}
              style={{ backgroundColor: color.hex }}
            >
              {selectedColor.id === color.id && (
                <span className="tool-rail-color-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
