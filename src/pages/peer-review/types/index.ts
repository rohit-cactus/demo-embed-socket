/**
 * Strict TypeScript types for the Peer Review PDF Annotation Viewer
 */

import { PdfAnnotationSubtype } from '@embedpdf/models'

// ============================================================================
// Core Annotation Types
// ============================================================================

export type AnnotationToolId =
  | 'select'
  | 'ink'
  | 'lineArrow'
  | 'square'
  | 'circle'
  | 'polygon'
  | 'freeText'
  | 'textComment'
  | 'highlight'
  | 'underline'
  | 'strikeout'

export type TextMarkupToolId = 'highlight' | 'underline' | 'strikeout'

export type ShapeToolId = 'lineArrow' | 'square' | 'circle' | 'polygon'

export type DrawingToolId = 'ink' | 'lineArrow' | 'square' | 'circle' | 'polygon'

export function isTextMarkupTool(tool: AnnotationToolId | null): tool is TextMarkupToolId {
  return tool === 'highlight' || tool === 'underline' || tool === 'strikeout'
}

export function isShapeTool(tool: AnnotationToolId | null): tool is ShapeToolId {
  return tool === 'square' || tool === 'circle' || tool === 'polygon'
}

export function isDrawingTool(tool: AnnotationToolId | null): tool is DrawingToolId {
  return tool === 'ink' || isShapeTool(tool)
}

/**
 * EmbedPDF's annotation object exposes its kind as the numeric
 * `PdfAnnotationSubtype` enum (from @embedpdf/models), not our tool id
 * strings. This maps the plugin's runtime annotation type back to our
 * AnnotationToolId so the UI can key off a single string union.
 */
export function mapAnnotationSubtypeToToolId(
  subtype: PdfAnnotationSubtype | undefined
): AnnotationToolId {
  switch (subtype) {
    case PdfAnnotationSubtype.LINE:
      return 'lineArrow'
    case PdfAnnotationSubtype.SQUARE:
      return 'square'
    case PdfAnnotationSubtype.CIRCLE:
      return 'circle'
    case PdfAnnotationSubtype.POLYGON:
      return 'polygon'
    case PdfAnnotationSubtype.INK:
      return 'ink'
    case PdfAnnotationSubtype.FREETEXT:
      return 'freeText'
    case PdfAnnotationSubtype.TEXT:
      return 'textComment'
    case PdfAnnotationSubtype.HIGHLIGHT:
      return 'highlight'
    case PdfAnnotationSubtype.UNDERLINE:
      return 'underline'
    case PdfAnnotationSubtype.STRIKEOUT:
      return 'strikeout'
    default:
      return 'select'
  }
}

// ============================================================================
// Styling Types
// ============================================================================

export type LineStyle = 'solid' | 'dashed' | 'dotted'

export interface LineStyleOption {
  id: LineStyle
  label: string
  dashArray: string | null
}

export const LINE_STYLES: LineStyleOption[] = [
  { id: 'solid', label: 'Solid', dashArray: null },
  { id: 'dashed', label: 'Dashed', dashArray: '8,4' },
  { id: 'dotted', label: 'Dotted', dashArray: '2,2' },
]

export interface ColorOption {
  id: string
  label: string
  hex: string
  highlightHex: string // For text markup (semi-transparent)
}

export const COLOR_PALETTE: ColorOption[] = [
  { id: 'yellow', label: 'Yellow', hex: '#facc15', highlightHex: '#fef08a' },
  { id: 'green', label: 'Green', hex: '#22c55e', highlightHex: '#bbf7d0' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6', highlightHex: '#bfdbfe' },
  { id: 'red', label: 'Red', hex: '#ef4444', highlightHex: '#fecaca' },
  { id: 'purple', label: 'Purple', hex: '#a855f7', highlightHex: '#e9d5ff' },
  { id: 'orange', label: 'Orange', hex: '#f97316', highlightHex: '#fed7aa' },
  { id: 'pink', label: 'Pink', hex: '#ec4899', highlightHex: '#fbcfe8' },
  { id: 'gray', label: 'Gray', hex: '#6b7280', highlightHex: '#e5e7eb' },
]

export const DEFAULT_COLOR = COLOR_PALETTE[0]
export const DEFAULT_LINE_STYLE = LINE_STYLES[0]

// ============================================================================
// Comment Types
// ============================================================================

export interface Comment {
  id: string
  parentId: string | null
  authorName: string
  text: string
  createdAt: number
  updatedAt?: number
  isDeleted?: boolean
}

export interface CommentThread {
  id: string
  annotationId: string
  pageIndex: number
  quote: string
  anchorRatio: number
  createdAt: number
  messages: Comment[]
}

// ============================================================================
// Annotation Meta Types
// ============================================================================

export interface AnnotationMeta {
  id: string
  color: string
  opacity: number
  lineStyle: LineStyle
  lineWidth: number
  /** Sticky-note text, persisted the same reliable way as color/line-style meta. */
  noteText?: string
  thread?: CommentThread
}

export type AnnotationMetaMap = Record<string, AnnotationMeta>

// ============================================================================
// Tool Configuration Types
// ============================================================================

export interface ToolConfig {
  id: AnnotationToolId
  name: string
  icon: string
  shortcut?: string
  category: 'selection' | 'drawing' | 'textMarkup'
}

export const TOOL_CONFIGS: ToolConfig[] = [
  { id: 'select', name: 'Select', icon: 'MousePointer', category: 'selection' },
  { id: 'ink', name: 'Pen', icon: 'Pencil', shortcut: 'P', category: 'drawing' },
  { id: 'lineArrow', name: 'Arrow', icon: 'ArrowRight', shortcut: 'A', category: 'drawing' },
  { id: 'square', name: 'Rectangle', icon: 'Square', shortcut: 'R', category: 'drawing' },
  { id: 'circle', name: 'Circle', icon: 'Circle', shortcut: 'C', category: 'drawing' },
  { id: 'polygon', name: 'Polygon', icon: 'Pentagon', shortcut: 'G', category: 'drawing' },
  { id: 'freeText', name: 'Text', icon: 'Type', shortcut: 'T', category: 'drawing' },
  { id: 'textComment', name: 'Sticky Note', icon: 'StickyNote', shortcut: 'N', category: 'drawing' },
  { id: 'highlight', name: 'Highlight', icon: 'Highlighter', shortcut: 'H', category: 'textMarkup' },
  { id: 'underline', name: 'Underline', icon: 'Underline', shortcut: 'U', category: 'textMarkup' },
  { id: 'strikeout', name: 'Strikethrough', icon: 'Strikethrough', shortcut: 'S', category: 'textMarkup' },
]

// ============================================================================
// UI State Types
// ============================================================================

export interface ToolbarState {
  activeTool: AnnotationToolId | null
  selectedColor: ColorOption
  selectedLineStyle: LineStyleOption
  lineWidth: number
}

export interface SelectionState {
  selectedAnnotationId: string | null
  hoveredAnnotationId: string | null
}

// ============================================================================
// Persistence Types
// ============================================================================

export interface PersistedAnnotationMeta {
  color: string
  opacity: number
  lineStyle: LineStyle
  lineWidth: number
  noteText?: string
}

export interface PersistedCommentThread {
  id: string
  annotationId: string
  pageIndex: number
  quote: string
  anchorRatio: number
  createdAt: number
  messages: Array<{
    id: string
    parentId: string | null
    authorName: string
    text: string
    createdAt: number
    updatedAt?: number
    isDeleted?: boolean
  }>
}
