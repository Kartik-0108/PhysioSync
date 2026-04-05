import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
          <div className="bg-slate-800 p-8 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-700">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <div className="bg-slate-900 p-4 rounded-lg overflow-auto text-sm text-slate-300 font-mono mb-6">
              {this.state.error?.message || 'Unknown error occurred'}
            </div>
            <button
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
