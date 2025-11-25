
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
     window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 text-center font-sans animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm leading-relaxed">
              The application encountered an unexpected error. We've logged this issue and notified our engineering team.
            </p>
            
            <div className="flex flex-col gap-3">
                <button 
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95"
                >
                  <RefreshCw size={18} /> Reload Page
                </button>
                <button 
                  onClick={this.handleHome}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors active:scale-95"
                >
                  <Home size={18} /> Return Home
                </button>
            </div>

            {this.state.error && (
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Error Details</p>
                    <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-left overflow-x-auto custom-scrollbar max-h-32 border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] font-mono text-red-500 break-words whitespace-pre-wrap">
                            {this.state.error.toString()}
                        </p>
                    </div>
                </div>
            )}
          </div>
          <div className="mt-8 text-slate-400 text-xs">
            ProManage AI • Stability Protection System
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
