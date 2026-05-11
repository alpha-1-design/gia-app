import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode; name: string }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center" style={{ background: 'var(--gia-bg)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={22} style={{ color: '#f87171' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{this.props.name} crashed</p>
          <p className="text-xs leading-relaxed max-w-[260px]" style={{ color: 'var(--gia-muted)' }}>
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button onClick={this.handleRetry} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-medium mt-2" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
