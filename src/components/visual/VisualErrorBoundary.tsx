import React from 'react';
import { ErrorVisual } from './common';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

/**
 * Wraps a single rendered visual block (chart, map, 3D scene, etc.) so that a
 * crash inside one visual — e.g. malformed or unexpected model-generated data —
 * only replaces that one block with an inline error, instead of throwing past
 * the message list and taking down the whole chat view.
 */
export default class VisualErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || error.name || 'Failed to render this visual' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[VisualErrorBoundary] visual block crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorVisual message={`This visual couldn't be displayed: ${this.state.message}`} />;
    }
    return this.props.children;
  }
}
