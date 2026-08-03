/**
 * Utility functions for styling annotations
 */

import type { ColorOption, LineStyle, LineStyleOption } from '../types'
import { COLOR_PALETTE, LINE_STYLES, DEFAULT_COLOR, DEFAULT_LINE_STYLE } from '../types'

/**
 * Get a color option by its ID
 */
export function getColorById(colorId: string): ColorOption {
  return COLOR_PALETTE.find((c) => c.id === colorId) ?? DEFAULT_COLOR
}

/**
 * Get a color option by its hex value
 */
export function getColorByHex(hex: string): ColorOption {
  return COLOR_PALETTE.find((c) => c.hex === hex || c.highlightHex === hex) ?? DEFAULT_COLOR
}

/**
 * Get a line style option by its ID
 */
export function getLineStyleById(lineStyleId: LineStyle): LineStyleOption {
  return LINE_STYLES.find((ls) => ls.id === lineStyleId) ?? DEFAULT_LINE_STYLE
}

/**
 * Convert a hex color to RGBA with specified opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Get the appropriate color for an annotation based on its type
 * - Shapes use solid color
 * - Text markup uses semi-transparent highlight color
 */
export function getAnnotationColor(colorId: string, isTextMarkup: boolean): string {
  const color = getColorById(colorId)
  return isTextMarkup ? color.highlightHex : color.hex
}

/**
 * Generate stroke dash array for SVG/Canvas based on line style
 */
export function getStrokeDashArray(lineStyle: LineStyle, lineWidth: number): string | undefined {
  const style = getLineStyleById(lineStyle)
  if (!style.dashArray) return undefined

  // Scale dash array based on line width
  const parts = style.dashArray.split(',').map((p) => parseInt(p.trim(), 10))
  return parts.map((p) => p * lineWidth).join(',')
}

/**
 * Calculate contrasting text color (black or white) for a given background
 */
export function getContrastingTextColor(hex: string): 'black' | 'white' {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? 'black' : 'white'
}

/**
 * Format time ago string
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const seconds = Math.floor((now - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
