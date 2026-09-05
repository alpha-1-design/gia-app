import React, { useMemo } from 'react';
import { parseVisualBlock } from './parseVisualBlock';
import { ErrorVisual, VisualLoading } from './common';
import VisualErrorBoundary from './VisualErrorBoundary';
import { ChartVisual } from './ChartVisual';
import { MindMapVisual } from './MindMapVisual';
import { DiffVisual } from './DiffVisual';
import { DataTableVisual } from './DataTableVisual';
import { ImageGalleryVisual } from './ImageGalleryVisual';
import { TimelineVisual } from './TimelineVisual';
import { TerminalVisual } from './TerminalVisual';
import { MetricWidgetVisual } from './MetricWidgetVisual';
import { WaveformVisual } from './WaveformVisual';
import { DocumentOutlineVisual } from './DocumentOutlineVisual';
import { MapVisual } from './MapVisual';
import { SlidesVisual } from './SlidesVisual';
import { CanvasVisual } from './CanvasVisual';
import ThreeVisual from './ThreeVisual';
import GraphVisual from './GraphVisual';
import { FileVisual } from './FileVisual';

const RenderVisualByType: React.FC<{ code: string; isStreaming?: boolean }> = ({ code, isStreaming }) => {
  const parsed = useMemo(() => parseVisualBlock(code), [code]);

  if ('error' in parsed) {
    // While the message is still streaming, an incomplete/malformed block is
    // expected — more tokens (including the closing fence) are still coming,
    // so keep showing the loading state. But once the message has finished
    // streaming, a parse failure here is permanent: no more tokens are ever
    // coming, so looping "Generating visualization..." forever is a lie.
    // Show the real reason instead once we know nothing more will arrive.
    if (isStreaming === false) {
      return <ErrorVisual message={`This visualization didn't finish generating (the response was cut off before it could complete) — ${parsed.error}`} />;
    }
    return <VisualLoading />;
  }

  const { type, data } = parsed;

  switch (type) {
    case 'chart':
      return <ChartVisual data={data} />;
    case 'mindmap':
    case 'mind_map':
    case 'mind-map':
      return <MindMapVisual data={data} />;
    case 'diff':
    case 'code_diff':
    case 'code-diff':
      return <DiffVisual data={data} />;
    case 'table':
    case 'data_table':
    case 'data-table':
      return <DataTableVisual data={data} />;
    case 'gallery':
    case 'image_gallery':
    case 'image-gallery':
      return <ImageGalleryVisual data={data} />;
    case 'timeline':
      return <TimelineVisual data={data} />;
    case 'terminal':
    case 'terminal_output':
    case 'terminal-output':
      return <TerminalVisual data={data} />;
    case 'widget':
    case 'metric':
    case 'metrics':
      return <MetricWidgetVisual data={data as never} />;
    case 'waveform':
    case 'audio':
      return <WaveformVisual data={data} />;
    case 'outline':
    case 'document_outline':
    case 'toc':
      return <DocumentOutlineVisual data={data} />;
    case 'map':
    case 'openstreetmap':
      return <MapVisual data={data} />;
    case 'slides':
    case 'presentation':
    case 'slide_deck':
    case 'slide-deck':
      return <SlidesVisual data={data} />;
    case 'canvas':
    case 'drawing':
    case 'diagram':
      return <CanvasVisual data={data} />;
    case '3d':
    case 'three':
    case 'threejs':
    case 'scene':
      return <ThreeVisual data={data} />;
    case 'graph':
    case 'network':
    case 'node_graph':
    case 'node-graph':
    case 'topology':
      return <GraphVisual data={data as never} />;
    case 'file_preview':
    case 'file-preview':
      return <FileVisual data={data as never} />;
    default:
      return <ErrorVisual message={`Unknown visual type: "${type}". Supported: chart, mindmap, diff, table, gallery, timeline, terminal, widget, waveform, outline, map, slides, canvas, 3d, graph, file_preview`} />;
  }
};

const VisualRenderer: React.FC<{ code: string; isStreaming?: boolean }> = ({ code, isStreaming }) => (
  <VisualErrorBoundary>
    <RenderVisualByType code={code} isStreaming={isStreaming} />
  </VisualErrorBoundary>
);

export default React.memo(VisualRenderer);
