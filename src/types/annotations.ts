export interface Author {
  id: string
  name: string
}

export interface Comment {
  id: string
  author: Author
  content: RichContent
  createdAt: number
  updatedAt?: number
}

export interface Annotation {
  id: string
  documentId: string
  pageIndex: number
  type: 'highlight' | 'underline' | 'strikeout' | 'text' | 'ink' | 'note'
  color?: string
  // Position coordinates
  rect?: {
    x: number
    y: number
    width: number
    height: number
  }
  // For ink annotations
  inkPoints?: Array<{ x: number; y: number }>
  // For text annotations
  textContent?: RichContent
  // For free text position
  position?: { x: number; y: number }
  // Comments thread
  comments: Comment[]
  author: Author
  createdAt: number
  updatedAt?: number
  isResolved?: boolean
}

export interface RichContent {
  blocks: Array<{
    type: 'paragraph' | 'header' | 'list'
    content: string
    formatting?: Array<{
      type: 'bold' | 'italic' | 'subscript' | 'superscript' | 'underline'
      start: number
      end: number
    }>
  }>
}

export interface AnnotationState {
  annotations: Annotation[]
  currentAuthor: Author
  isVisible: boolean
  isReadOnly: boolean
  showComments: boolean
}

export type AnnotationTool = 'select' | 'highlight' | 'underline' | 'strikeout' | 'text' | 'note' | 'ink' | null

export interface ToolbarState {
  activeTool: AnnotationTool
  highlightColor: string
  inkColor: string
  inkWidth: number
  fontSize: number
  fontFamily: string
}
