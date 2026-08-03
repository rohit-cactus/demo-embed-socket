# Fix for PDF Not Loading Issue

## Problem
When you run the application, the PDF viewer shows white screen instead of rendering the PDF document.

## Root Cause
The PDFViewer component needs a proper container with defined dimensions. Without explicit height sizing, the parent container collapses and the viewer has no space to render.

## Solution Applied

### 1. CSS Fixes
Added proper flex layout with height constraints:

**In `src/styles/CustomViewer.css`:**
```css
.pdf-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--surface-alt);
  display: flex;
  flex-direction: column;
  min-height: 0;  /* KEY: Prevents flex items from exceeding container */
}

.pdf-container > div {
  flex: 1 !important;         /* Takes remaining space */
  min-height: 0 !important;   /* KEY: Critical for nested elements */
  max-height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}
```

**In `src/styles/App.css`:**
```css
.main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main > div {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

### 2. File Input Support
Added feature to upload local PDF files in `src/pages/CustomViewer.tsx`:

```typescript
const [pdfSrc, setPdfSrc] = useState<string | null>(null)

const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    if (dataUrl) {
      setPdfSrc(dataUrl)  // Convert to Data URL
    }
  }
  reader.readAsDataURL(file)
}
```

Added UI controls:
```jsx
<div className="file-input-section">
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
</div>
```

## How to Test the Fix

### Test 1: Sample PDF (Should load immediately)
1. Start the app: `npm run dev`
2. Navigate to `/custom`
3. You should see PDF loading immediately
4. ✅ If you see PDF content, fix is working!

### Test 2: Upload Local PDF
1. Click "📂 Open Document"
2. Select a PDF file from your computer
3. PDF should load and render
4. ✅ If you see your PDF, fix is working!

### Test 3: Verify Container Size
Open browser DevTools (F12) and run:
```javascript
// Should return > 0
document.querySelector('.pdf-container').offsetHeight
document.querySelector('.pdf-container').offsetWidth
```

Expected output:
```
offsetHeight: 1080  (or your screen height)
offsetWidth: 1024   (or your screen width)
```

If you get 0, the flex layout isn't working properly.

## Troubleshooting

### Still White Screen?

**Step 1: Clear Cache**
```
Press: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

**Step 2: Check DevTools**
```
F12 → Application → Local Storage → http://localhost:5173
```
Look for `embedpdf_annotations_*` entries

**Step 3: Monitor Network**
```
F12 → Network tab
```
- Refresh page
- Look for PDF file requests
- Check if they return 200 status

**Step 4: Check Container**
```
F12 → Elements tab
```
- Right-click on PDF viewer
- Inspect element
- Check computed styles for width/height
- Should see `flex: 1` and height values

### Error: "PDF is not defined"
```bash
npm install
npm run dev
```

### Error: "Cannot read property 'appendChild' of null"
The container doesn't exist or has zero height. Check DevTools as described above.

### Error: "CORS error"
This happens with some remote URLs. Use local file upload instead:
```
Click "📂 Open Document" and select a local PDF file
```

## Performance Tips

1. **Use Local Files**: Faster than remote URLs
2. **Small PDFs**: Start with <10MB files for testing
3. **Modern Browser**: Use Chrome/Firefox for best performance
4. **Close Comment Panel**: Improves rendering when not needed

## Browser Console Debugging

Add this to `CustomViewer.tsx` for debugging:

```typescript
useEffect(() => {
  console.log('Current PDF Source:', currentDocumentSrc)
  const container = document.querySelector('.pdf-container')
  console.log('Container Element:', container)
  console.log('Container Height:', container?.offsetHeight)
  console.log('Container Width:', container?.offsetWidth)
}, [currentDocumentSrc])
```

Then open DevTools Console (F12 → Console) and you'll see the values.

## What Was Changed

### Files Modified
1. `src/pages/CustomViewer.tsx` - Added file upload
2. `src/styles/CustomViewer.css` - Added flex layout fixes
3. `src/styles/App.css` - Added flex layout fixes
4. `src/pages/DefaultViewer.tsx` - Added CSS import

### Files Created
1. `src/styles/DefaultViewer.css` - Route 1 sizing

### Key Changes
- Added `flex: 1` to containers
- Added `min-height: 0` to nested elements
- Added file input handling
- Added Data URL conversion for PDFs
- Added proper error handling

## Verification Checklist

- [ ] Run `npm run dev`
- [ ] See sample PDF load immediately
- [ ] Click "📂 Open Document"
- [ ] Select a local PDF file
- [ ] PDF loads and renders
- [ ] Left toolbar visible
- [ ] Right panel collapses properly
- [ ] Can create annotations
- [ ] Can add comments
- [ ] Page refresh keeps data

All checked? ✅ **PDF loading issue is fixed!**

## If Issue Persists

### Option 1: Rebuild
```bash
rm -rf node_modules
npm install
npm run dev
```

### Option 2: Check Node Version
```bash
node --version
```
Should be v16+, ideally v18+

### Option 3: Use Sample PDF First
Try using the sample PDF before uploading custom files.

### Option 4: Test in Different Browser
Try Chrome, Firefox, or Safari to isolate issues.

## Support

- **EmbedPDF Docs**: https://www.embedpdf.com/docs
- **Issue Tracker**: See TROUBLESHOOTING.md
- **Discord**: https://discord.gg/mHHABmmuVU

---

**Status**: ✅ PDF loading issue should be resolved!

If you're still experiencing issues after applying these fixes, check TROUBLESHOOTING.md for more detailed debugging steps.
