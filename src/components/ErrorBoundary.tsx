import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { voiceDebugger } from '../utils/debug';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to debugging system
    voiceDebugger.logError('ReactErrorBoundary', error.message, {
      componentStack: errorInfo.componentStack,
      errorName: error.name,
      errorStack: error.stack
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    // Clear error state and attempt to recover
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Log recovery attempt
    voiceDebugger.logInfo('Error boundary recovery attempted');
  };

  handleReload = () => {
    // Reload the page as last resort
    voiceDebugger.logInfo('Page reload requested due to error boundary');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-red-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h2>
            
            <p className="text-gray-300 mb-6">
              The application encountered an unexpected error. Don't worry, we've logged this issue.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-red-300 mb-2">Error Details:</h3>
                <p className="text-sm text-red-200 mb-2">
                  <strong>Type:</strong> {this.state.error.name}
                </p>
                <p className="text-sm text-red-200 mb-2">
                  <strong>Message:</strong> {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="text-xs text-red-300">
                    <summary className="cursor-pointer">Stack Trace</summary>
                    <pre className="mt-2 overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;