import { useState, useRef, useCallback, useEffect } from 'react'
import { PDFViewer } from '@embedpdf/react-pdf-viewer'
import Toolbar from '../components/Toolbar'
import CommentPanel from '../components/CommentPanel'
import AnnotationLayer from '../components/AnnotationLayer'
import { useAnnotations } from '../hooks/useAnnotations'
import { AnnotationTool } from '../types/annotations'
import '../styles/CustomViewer.css'

const SAMPLE_PDF = 'https://snippet.embedpdf.com/ebook.pdf'

const CustomViewer = () => {
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [pdfSrc, setPdfSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use sample PDF by default
  const currentDocumentSrc = pdfSrc || SAMPLE_PDF

  const {
    annotations,
    currentAuthor,
    isVisible,
    showComments,
    isReadOnly,
    setIsVisible,
    setShowComments,
    setIsReadOnly,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment,
    updateAuthorName,
  } = useAnnotations(currentDocumentSrc)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please select a valid PDF file')
      return
    }

    setIsLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (dataUrl) {
        setPdfSrc(dataUrl)
        setIsLoading(false)
      }
    }
    reader.onerror = () => {
      setError('Failed to load PDF file')
      setIsLoading(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleOpenClick = () => {
    fileInputRef.current?.click()
  }

  const handleExport = useCallback(async (type: 'annotations' | 'comments' | 'all') => {
    // TODO: Implement PDF export with annotations
    // This would use the EmbedPDF export plugin functionality
    console.log('Export:', type)
    alert(`Export ${type} functionality coming soon!`)
  }, [])

  return (
    <div className="custom-viewer">
      {/* Top bar with username */}
      <div className="top-bar">
        <div className="username-section">
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            type="text"
            value={currentAuthor.name}
            onChange={(e) => updateAuthorName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>

        {/* Control buttons */}
        <div className="controls">
          <button
            className={`control-btn ${isVisible ? 'active' : ''}`}
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? 'Hide Annotations' : 'Show Annotations'}
          >
            {isVisible ? '👁️ Hide Annotations' : '👁️‍🗨️ Show Annotations'}
          </button>
          <button
            className={`control-btn ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
            title={showComments ? 'Hide Comments' : 'Show Comments'}
          >
            {showComments ? '💬 Hide Comments' : '💬 Show Comments'}
          </button>
          <button
            className={`control-btn ${isReadOnly ? 'active' : ''}`}
            onClick={() => setIsReadOnly(!isReadOnly)}
            title={isReadOnly ? 'Enable Editing' : 'Make Read-only'}
          >
            {isReadOnly ? '🔒 Read-only' : '✏️ Edit Mode'}
          </button>

          {/* Download options */}
          <div className="download-dropdown">
            <button className="dropdown-trigger">📥 Download</button>
            <div className="dropdown-menu">
              <button onClick={() => handleExport('annotations')}>
                Annotations Only
              </button>
              <button onClick={() => handleExport('comments')}>
                Comments Only
              </button>
              <button onClick={() => handleExport('all')}>
                All (PDF + Annotations + Comments)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main viewer area */}
      <div className="viewer-area">
        {/* Left toolbar */}
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isReadOnly={isReadOnly}
        />

        {/* PDF Viewer container */}
        <div className="pdf-container">
          {/* File input section */}
          {/* <div className="file-input-section">
            <label className="file-input-label">
              <span>📂 Open Document</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="file-input"
              />
            </label>
            {pdfSrc && (
              <button
                onClick={() => {
                  setPdfSrc(null)
                  setError(null)
                }}
                className="file-input-label"
                title="Load sample PDF"
              >
                ↺ Use Sample PDF
              </button>
            )}
            {error && (
              <span style={{ color: 'var(--error)', fontSize: '0.875rem' }}>
                {error}
              </span>
            )}
          </div> */}

          {/* PDF Viewer */}
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              background: 'var(--surface-alt)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                <p>Loading PDF...</p>
              </div>
            </div>
          ) : (
            <>
              <PDFViewer
                ref={viewerRef}
                config={{
                  src: currentDocumentSrc,
                  theme: { preference: 'light' },
                  disabledCategories: ['annotation'], // We'll handle annotations ourselves
                }}
              />
              {isVisible && (
                <AnnotationLayer
                  annotations={annotations}
                  activeTool={activeTool}
                  selectedAnnotation={selectedAnnotation}
                  setSelectedAnnotation={setSelectedAnnotation}
                  addAnnotation={addAnnotation}
                  updateAnnotation={updateAnnotation}
                  deleteAnnotation={deleteAnnotation}
                  isReadOnly={isReadOnly}
                />
              )}
            </>
          )}
        </div>

        {/* Right comment panel */}
        {showComments && selectedAnnotation && (
          <CommentPanel
            annotation={annotations.find((a) => a.id === selectedAnnotation)}
            addComment={addComment}
            updateComment={updateComment}
            deleteComment={deleteComment}
            onClose={() => setSelectedAnnotation(null)}
            currentAuthor={currentAuthor}
            isReadOnly={isReadOnly}
          />
        )}
      </div>
    </div>
  )
}

export default CustomViewer
