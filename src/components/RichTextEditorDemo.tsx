import { useState } from 'react'
import RichTextEditor from './RichTextEditor'

/**
 * Demo component showing RichTextEditor with all features
 * Use this to test formatting options before using in your app
 */
export const RichTextEditorDemo = () => {
  const [comment, setComment] = useState('')
  const [reply, setReply] = useState('')

  return (
    <div
      style={{
        padding: 20,
        background: '#f9fafb',
        borderRadius: 8,
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
        Rich Text Editor Demo
      </h1>

      {/* Section 1: Comment Input */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
          Comment Input (New Thread)
        </h2>
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <RichTextEditor
            content={{ html: comment }}
            onChange={(content) => setComment(content.html)}
            placeholder="Write your comment here... Try: Select text → Click Bold/Italic → Add formulas with Super/Subscript"
            minHeight={100}
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          <strong>Live Preview (HTML):</strong>
          <pre
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              padding: 8,
              marginTop: 6,
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 100,
            }}
          >
            {comment || '(Empty)'}
          </pre>
        </div>
      </div>

      {/* Section 2: Reply Input */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
          Reply Input (Existing Thread)
        </h2>
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <RichTextEditor
            content={{ html: reply }}
            onChange={(content) => setReply(content.html)}
            placeholder="Write your reply here..."
            minHeight={80}
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          <strong>Live Preview (HTML):</strong>
          <pre
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              padding: 8,
              marginTop: 6,
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 100,
            }}
          >
            {reply || '(Empty)'}
          </pre>
        </div>
      </div>

      {/* Features Guide */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Features & Shortcuts
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
              Format Options
            </strong>
            <ul style={{ fontSize: 11, color: '#6b7280', margin: 0, paddingLeft: 16 }}>
              <li>Select text → Click <strong>B</strong> for Bold</li>
              <li>Select text → Click <strong>I</strong> for Italic</li>
              <li>Select text → Click <strong>X₂</strong> for Subscript</li>
              <li>Select text → Click <strong>X²</strong> for Superscript</li>
            </ul>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
            <strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
              Keyboard Shortcuts
            </strong>
            <ul style={{ fontSize: 11, color: '#6b7280', margin: 0, paddingLeft: 16 }}>
              <li><strong>Ctrl+B</strong> (Win) / <strong>Cmd+B</strong> (Mac) → Bold</li>
              <li><strong>Ctrl+I</strong> (Win) / <strong>Cmd+I</strong> (Mac) → Italic</li>
              <li>Select text for formatting</li>
              <li>Button highlights when active</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
          Example Use Cases
        </h2>
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
            color: '#1e40af',
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Scientific Writing:</strong> H<sub>2</sub>O, E=mc<sup>2</sup>
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Code Comments:</strong> The function returns <strong>true</strong> when validation succeeds
          </p>
          <p style={{ margin: 0 }}>
            <strong>Emphasis:</strong> This is <italic>really important</italic> to note!
          </p>
        </div>
      </div>
    </div>
  )
}

export default RichTextEditorDemo
