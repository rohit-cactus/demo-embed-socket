import { PDFViewer } from '@embedpdf/react-pdf-viewer'
import '../styles/DefaultViewer.css'

const DefaultViewer = () => {
  return (
    <div className="default-viewer">
      <PDFViewer
        config={{
          src: 'https://snippet.embedpdf.com/ebook.pdf',
          theme: {
            preference: 'light',
          },
        }}
      />
    </div>
  )
}

export default DefaultViewer
