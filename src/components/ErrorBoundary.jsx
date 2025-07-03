import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // Логируем ошибку
    console.error('React Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-tg-bg text-tg-text flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertTriangle size={64} className="mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-bold mb-2">Что-то пошло не так</h1>
            <p className="text-tg-hint mb-4">
              Произошла неожиданная ошибка. Попробуйте перезагрузить страницу.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-tg-button text-tg-button-text rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={16} />
              Перезагрузить
            </button>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left text-xs">
                <summary className="cursor-pointer text-tg-hint">
                  Детали ошибки (только в разработке)
                </summary>
                <pre className="mt-2 p-2 bg-gray-800 rounded text-red-600 overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary 