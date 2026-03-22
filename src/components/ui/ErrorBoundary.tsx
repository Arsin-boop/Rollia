import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#0a080e', color: '#c8a54a',
          fontFamily: 'Cinzel, serif', textAlign: 'center', padding: '2rem', gap: '1rem'
        }}>
          <p style={{ fontSize: '1.1rem', color: 'rgba(200,165,74,0.7)' }}>
            Что-то пошло не так. Попробуй перезагрузить страницу.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontFamily: 'Cinzel, serif', fontSize: 13, letterSpacing: '0.08em',
              textTransform: 'uppercase', border: '1px solid rgba(200,165,74,0.3)',
              color: 'rgba(200,165,74,0.7)', background: 'transparent',
              padding: '8px 20px', cursor: 'pointer',
              clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))'
            }}
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
