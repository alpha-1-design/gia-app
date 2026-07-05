import React from 'react';
import { AlertTriangle, Clipboard, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode; name: string }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const detail = `${error.name}: ${error.message}\n${error.stack?.split('\n').slice(0, 3).join('\n') || ''}\n\nComponent stack:\n${info.componentStack?.split('\n').slice(0, 5).join('\n') || ''}`;
    try { sessionStorage.setItem(`gia:error:${this.props.name}`, detail); } catch { /* sessionStorage may be full */ }
    console.error(`[ErrorBoundary] ${this.props.name} crashed:`, error, info);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  handleCopy = () => {
    const err = this.state.error;
    const text = `${err?.name || 'Error'}: ${err?.message || 'no message'}\n\n${err?.stack?.split('\n').slice(0, 5).join('\n') || ''}`;
    try { navigator.clipboard?.writeText(text); } catch { /* clipboard not available */ }
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const displayMessage = err?.message || err?.name || 'Something went wrong';
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center" style={{ background: 'var(--gia-bg)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={22} style={{ color: '#f87171' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{this.props.name} crashed</p>
          <pre className="text-xs leading-relaxed max-w-[300px] whitespace-pre-wrap font-mono" style={{ color: 'var(--gia-muted)' }}>
            {displayMessage}
          </pre>
          <div className="flex gap-2 mt-2">
            <button onClick={this.handleRetry} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
              <RefreshCw size={12} /> Retry
            </button>
            <button onClick={this.handleCopy} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
              <Clipboard size={12} /> Copy error
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
