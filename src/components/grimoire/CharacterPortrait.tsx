interface CharacterPortraitProps {
  icon: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { outer: 44, fontSize: 22 },
  md: { outer: 120, fontSize: 56 },
  lg: { outer: 160, fontSize: 72 },
}

export function CharacterPortrait({ icon, size = 'md', className = '' }: CharacterPortraitProps) {
  const { outer, fontSize } = sizes[size]
  const clipSize = size === 'sm' ? 5 : size === 'md' ? 12 : 16

  return (
    <div
      className={`g-portrait ${className}`}
      style={{
        width: outer,
        height: outer * 1.18,
        flexShrink: 0,
        clipPath: `polygon(0 0, calc(100% - ${clipSize}px) 0, 100% ${clipSize}px, 100% 100%, ${clipSize}px 100%, 0 calc(100% - ${clipSize}px))`,
      }}
    >
      <div className="g-portrait-bg" />
      <div className="g-portrait-glow" />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize,
        filter: 'drop-shadow(0 4px 16px rgba(200,165,74,0.18))',
        zIndex: 2,
      }}>
        {icon}
      </div>

      <div className="g-portrait-inner-border" />

      <div className="g-corner g-corner-tl" />
      <div className="g-corner g-corner-tr" />
      <div className="g-corner g-corner-bl" />
      <div className="g-corner g-corner-br" />
    </div>
  )
}
