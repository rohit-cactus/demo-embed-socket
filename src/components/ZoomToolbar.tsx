import { useZoom } from '@embedpdf/plugin-zoom/react';
 
interface ZoomToolbarProps {
  documentId: string;
}
 
export const ZoomToolbar = ({ documentId }: ZoomToolbarProps) => {
  const { provides: zoomProvides, state: zoomState } = useZoom(documentId);
 
  if (!zoomProvides) {
    return null;
  }
 
  return (
    <div>
      <span>Current Zoom: {Math.round(zoomState.currentZoomLevel * 100)}%</span>
      <button onClick={zoomProvides.zoomOut}>-</button>
      <button onClick={zoomProvides.zoomIn}>+</button>
      <button onClick={() => zoomProvides.requestZoom(1.0)}>Reset</button>
    </div>
  );
};