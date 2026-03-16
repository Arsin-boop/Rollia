import { ReactNode } from 'react'
import { useEmberCanvas } from '../../hooks/useEmberCanvas'

interface GrimoirePageProps {
  children: ReactNode
  emberCount?: number
  showRunes?: boolean
  className?: string
}

export function GrimoirePage({
  children,
  emberCount = 120,
  showRunes = false,
  className = '',
}: GrimoirePageProps) {
  const canvasRef = useEmberCanvas({ count: emberCount, includeRunes: showRunes })

  return (
    <div
      className={`g-page ${className}`}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 10, height: '100%' }}>
        {children}
      </div>
    </div>
  )
}
