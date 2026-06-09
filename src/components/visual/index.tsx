import React, { useMemo } from 'react';
import { parseVisualBlock } from './parseVisualBlock';
import { ErrorVisual } from './common';
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

const VisualRenderer: React.FC<{ code: string }> = ({ code }) => {
  const parsed = useMemo(() => parseVisualBlock(code), [code]);

  if ('error' in parsed) return <ErrorVisual message={parsed.error} />;

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
    default:
      return <ErrorVisual message={`Unknown visual type: "${type}". Supported: chart, mindmap, diff, table, gallery, timeline, terminal, widget, waveform, outline, map`} />;
  }
};

export default React.memo(VisualRenderer);
