type Props = {
  /** Tamanho em pixels (largura/altura). Default 40. */
  size?: number
  /** Mostra o pequeno quadrado de acento ao lado do R. Default true. */
  showAccent?: boolean
  /** Cor principal do R. Default gold. */
  color?: string
  /** Cor do acento. Default verde-acinzentado. */
  accentColor?: string
  /** className extra para o container. */
  className?: string
}

/**
 * Mark Rasch reutilizável — SVG inline, escala perfeita.
 * Interpretação geométrica do R com canto chanfrado + perna diagonal,
 * mais o pequeno quadrado de acento (opcional).
 */
export default function RaschMark({
  size = 40,
  showAccent = true,
  color = '#C9A961',
  accentColor = '#5A7A7E',
  className = '',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Rasch Remodeling"
    >
      {showAccent && (
        <rect x="2" y="68" width="22" height="22" fill={accentColor} opacity="0.92" />
      )}
      <g fill={color}>
        {/* corpo superior do R com canto chanfrado */}
        <path d="M 16 10 L 70 10 L 86 26 L 86 50 L 50 50 L 50 62 L 16 62 Z" />
        {/* perna diagonal */}
        <path d="M 50 50 L 64 50 L 92 92 L 78 92 Z" />
      </g>
    </svg>
  )
}
