# PDF Viewer Troubleshooting Guide

## Issue: PDF Not Loading / White Screen

### Root Causes
1. **Missing container height**: The PDFViewer component needs explicit height defined in CSS
2. **Nested div overflow issues**: The PDFViewer component internally renders nested divs that inherit sizing incorrectly
3. **Flex layout conflicts**: Without proper flex properties, child elements don't render

### Solution Implemented

#### 1. CSS Fixes
- Added `flex: 1` and `min-height: 0` to `.pdf-container`
- Added explicit height rules with `!important` for PDFViewer's internal structure
- Ensured `.main` and `.viewer-area` have proper flex layout

#### 2. Container Sizing
```css
.pdf-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pdf-container > div {
  flex: 1 !important;
  min-height: 0 !important;
  max-height: 100% !important;
}
```

#### 3. File Loading Feature Added
- Click "📂 Open Document" to load local PDF files
- PDFViewer converts files to Data URLs for rendering
- Sample PDF button allows resetting to default

### How to Use

#### Route 1: Default Viewer
- Navigate to `/` or click "Default Viewer"
- Sample PDF loads automatically
- Full EmbedPDF toolbar available

#### Route 2: Custom Viewer
- Navigate to `/custom` or click "Custom Viewer"
- Click "📂 Open Document" to load a local PDF file
- Or click "↺ Use Sample PDF" to load the default sample
- Use left toolbar for annotations

### Testing the Fix

1. **Check Browser Console**: Press F12 and look for any errors
2. **Verify CSS**: Right-click > Inspect > Check if container has height
3. **Check Network**: Ensure PDF file is downloading (Network tab)
4. **Test File Upload**: Try uploading a small PDF file first

### If PDF Still Doesn't Load

Try these steps:

1. **Clear Browser Cache**
   ```bash
   # Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   ```

2. **Check CORS Issues**: 
   - Ensure sample PDF URL is accessible: https://snippet.embedpdf.com/ebook.pdf
   - Try uploading a local PDF file instead

3. **Verify Dependencies**:
   ```bash
   npm list @embedpdf/react-pdf-viewer
   ```

4. **Rebuild Application**:
   ```bash
   npm run build
   ```

### Browser Console Errors and Fixes

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot read property 'appendChild' of null" | No DOM element | Check container height |
| "CORS error" | Cross-origin PDF | Use data URL from file upload |
| "PDF is not defined" | Missing dependency | Run `npm install` |
| "Canvas context is null" | Rendering issue | Check CSS display/visibility |

### Debugging Steps

1. **Add Debug Logs** to CustomViewer.tsx:
   ```typescript
   useEffect(() => {
     console.log('PDF Source:', currentDocumentSrc)
     console.log('Container element:', document.querySelector('.pdf-container'))
   }, [currentDocumentSrc])
   ```

2. **Check Element Dimensions**:
   ```javascript
   // In browser console:
   document.querySelector('.pdf-container').offsetHeight // Should be > 0
   document.querySelector('.pdf-container').offsetWidth  // Should be > 0
   ```

3. **Monitor Network**:
   - Open DevTools > Network tab
   - Look for PDF file request
   - Check if it returns 200 status

## Performance Tips

- For large PDFs (>50MB), consider splitting into multiple documents
- Use local file upload instead of remote URLs for faster loading
- Close comment panel when not needed to improve rendering performance

## Known Limitations

1. **Ink annotations** are rendered on canvas layer but not persisted to PDF
2. **Export functionality** is not yet implemented (placeholder only)
3. **Multiple documents** are not supported in current version (single document focus)
4. **Search & replace** features require additional EmbedPDF plugin integration

## Next Steps to Improve

1. Implement actual PDF export with annotations using `@embedpdf/plugin-export`
2. Add multi-document support with tabs
3. Implement undo/redo for annotations
4. Add annotation export to JSON format
5. Implement full-text search integration

## Support

For more information:
- [EmbedPDF Docs](https://www.embedpdf.com/docs)
- [GitHub Repository](https://github.com/embedpdf/embed-pdf-viewer)
- [Discord Community](https://discord.gg/mHHABmmuVU)
