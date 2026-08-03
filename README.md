# EmbedPDF React Annotation Viewer POC

A production-ready proof of concept for an advanced PDF annotation and collaboration system built with React, TypeScript, and EmbedPDF.

## Features

### Route 1: Default Viewer (`/`)
- Full-featured PDF viewer using EmbedPDF's drop-in component
- All standard tools: zoom, search, annotations, forms, printing
- Professional UI with minimal configuration
- Perfect for users who need a complete viewer out of the box

### Route 2: Custom Viewer (`/custom`)
Advanced annotation system with:

#### Document Management
- 📂 Open local PDF files
- 🔄 Switch between sample and uploaded documents
- Error handling for invalid files

#### Toolbar (Left Side)
- **Zoom Controls**: Zoom in/out buttons
- **Text Annotations**:
  - Highlight text (multiple colors)
  - Underline text
  - Strike-through text
- **Text Tool**: Add free-form text with custom font/size
- **Note Tool**: Add sticky notes
- **Drawing**: Freehand ink annotations with color and width controls

#### Comment System (Right Panel)
- **Comment Threads**: Each annotation can have multiple comments
- **Rich Text Editor**:
  - Bold, Italic, Underline formatting
  - Superscript/Subscript support
  - Multi-paragraph support
- **User Attribution**: Shows author name and timestamp
- **Edit/Delete**: Modify or remove own comments
- **Threading**: Thread comments under annotations

#### Top Controls
- **Username**: Set your name (persisted in localStorage)
- **Annotation Visibility**: Toggle annotations on/off
- **Comment Visibility**: Show/hide comments panel
- **Read-only Mode**: Prevent edits while reviewing
- **Download Options**: (Placeholder for future implementation)

#### Data Persistence
- All annotations saved to localStorage
- Comments thread preserved across sessions
- Author identity maintained
- Annotations load automatically on revisit

## Quick Start

### Prerequisites
- Node.js v16+ (ideally v18+)
- npm v8+

### Installation

```bash
cd embed-pdf-app
npm install
```

### Development

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output files in `dist/` folder

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
embed-pdf-app/
├── src/
│   ├── pages/                  # Route components
│   │   ├── DefaultViewer.tsx   # Route 1: Drop-in viewer
│   │   └── CustomViewer.tsx    # Route 2: Custom annotations
│   ├── components/             # Reusable components
│   │   ├── Toolbar.tsx         # Left annotation toolbar
│   │   ├── AnnotationLayer.tsx # Canvas overlay for annotations
│   │   ├── CommentPanel.tsx    # Right comment panel
│   │   └── RichTextEditor.tsx  # Comment text editor
│   ├── hooks/                  # Custom React hooks
│   │   └── useAnnotations.ts   # Annotation state & localStorage
│   ├── types/                  # TypeScript definitions
│   │   └── annotations.ts      # Core type definitions
│   ├── styles/                 # CSS modules
│   │   ├── index.css           # Global styles
│   │   ├── App.css             # App layout
│   │   ├── DefaultViewer.css   # Route 1 styles
│   │   ├── CustomViewer.css    # Route 2 layout
│   │   ├── Toolbar.css         # Toolbar styles
│   │   ├── AnnotationLayer.css # Annotation styles
│   │   ├── CommentPanel.css    # Comment panel styles
│   │   └── RichTextEditor.css  # Editor styles
│   ├── App.tsx                 # Main app component
│   └── main.tsx                # React entry point
├── index.html                  # HTML template
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
└── README.md                   # This file
```

## Dependencies

### Core
- **react** (^18.2.0): UI framework
- **react-dom** (^18.2.0): React DOM rendering
- **react-router-dom** (^6.22.0): Routing
- **@embedpdf/react-pdf-viewer** (^2.14.0): PDF viewer component

### Development
- **vite** (^5.1.0): Build tool
- **typescript** (^5.2.2): Type safety
- **@vitejs/plugin-react** (^4.2.1): Vite React plugin

## Usage Guide

### For End Users

#### Route 1: Default Viewer
1. Click "Default Viewer" in navigation
2. Use the built-in toolbar for:
   - Zooming/panning
   - Text selection
   - Searching
   - Annotating
   - Printing
   - Exporting

#### Route 2: Custom Annotation Viewer
1. Click "Custom Viewer" in navigation
2. **Load a PDF**:
   - Click "📂 Open Document" to upload a local PDF
   - Or use the sample PDF that loads by default
3. **Set Your Name**:
   - Enter your name in the "Username" field
   - It will appear on all your comments
4. **Create Annotations**:
   - Select a tool from the left toolbar
   - Click on the PDF to place annotation
   - For text annotations, type in the popup dialog
5. **Add Comments**:
   - Click an annotation to open the comment panel
   - Write your comment using the rich text editor
   - Click "Add Comment" to save
6. **Manage Visibility**:
   - Use top buttons to hide/show annotations or comments
   - Enable "Read-only" to review without editing

### For Developers

#### Adding New Annotation Types

1. Add type to `src/types/annotations.ts`:
```typescript
export type AnnotationTool = '...existing...' | 'newType'
```

2. Add rendering in `src/components/AnnotationLayer.tsx`:
```typescript
case 'newType':
  return <div>/* render newType */</div>
```

3. Add toolbar button in `src/components/Toolbar.tsx`:
```typescript
<button
  className={`toolbar-btn ${activeTool === 'newType' ? 'active' : ''}`}
  onClick={() => handleToolClick('newType')}
>
  {/* icon */}
</button>
```

#### Implementing Export

Replace placeholder in `CustomViewer.tsx`:
```typescript
const handleExport = async (type: 'annotations' | 'comments' | 'all') => {
  // Use @embedpdf/plugin-export to generate PDF
  // Or use pdfkit to create new PDF with annotations
}
```

#### Implementing Multi-Document Tabs

Use EmbedPDF's `DocumentManagerPluginPackage` in headless mode to:
- Load multiple PDFs
- Track active document
- Switch between documents
- Persist annotations per document

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (WebAssembly requirement)

## Performance Characteristics

- Initial load: ~2-3 seconds (includes WASM module)
- PDF rendering: Real-time with virtualization
- Annotations: Instant add/edit
- Comments: Real-time updates
- Persistence: localStorage (5-50MB limit depending on browser)

## Known Issues & Limitations

1. **Node Version**: Developed on Node v16; v18+ recommended
2. **Ink Annotations**: Not persisted to PDF (canvas-only)
3. **Export**: Currently a placeholder (shows alert)
4. **Multi-document**: Single document focus in current version
5. **Search**: Not integrated with comment search

## Roadmap

- [ ] Implement PDF export with annotations
- [ ] Add multi-document support with tabs
- [ ] Implement undo/redo
- [ ] Add annotation export (JSON/XML)
- [ ] Comment search functionality
- [ ] Collaborative real-time editing
- [ ] Server-side persistence
- [ ] Advanced form field support

## Troubleshooting

### PDF Not Loading?
- Check `TROUBLESHOOTING.md` for detailed debug steps
- Ensure PDF URL is accessible or use file upload
- Try clearing browser cache (Cmd+Shift+R)

### Annotations Not Saving?
- Check browser's localStorage isn't full
- Ensure cookies/storage are enabled
- Try uploading a fresh PDF

### Performance Issues?
- Close comment panel when not needed
- Use smaller PDF files for testing
- Check browser memory usage

## License

MIT - See LICENSE file for details

## Support & Community

- **Documentation**: [EmbedPDF Docs](https://www.embedpdf.com/docs)
- **GitHub**: [embedpdf/embed-pdf-viewer](https://github.com/embedpdf/embed-pdf-viewer)
- **Discord**: [Community Server](https://discord.gg/mHHABmmuVU)

## Building for Presentation

1. **Prepare sample PDFs**: Use concise, visually interesting PDFs
2. **Pre-load annotations**: Create sample annotations before demo
3. **Use Read-only mode**: During presentation to avoid accidental edits
4. **Build for production**: `npm run build && npm run preview`

## Credits

Built with EmbedPDF - The open-source PDF viewer for web applications.

---

**Created**: August 2026  
**Version**: 1.0.0  
**Status**: Production-Ready POC
