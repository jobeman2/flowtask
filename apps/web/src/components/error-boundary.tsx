'use client';

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FlowTask ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
