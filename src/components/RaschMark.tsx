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
  /** Quando definido, move ligeiramente o quadrado de acento — usado em
   *  contextos com efeito parallax (ex: Hub). */
  parallax?: { x: number; y: number }
}

/**
 * Mark Rasch reutilizável — SVG inline, escala perfeita.
 * R estilizado: stem vertical à esquerda, bowl que afunila para um vértice
 * V no meio da haste, perna diagonal que sai desse mesmo vértice até ao
 * canto inferior-direito. Quadrado de acento opcional no canto inferior-esquerdo.
 */
export default function RaschMark({
  size = 40,
  showAccent = true,
  color = '#C9A961',
  accentColor = '#5A7A7E',
  className = '',
  parallax,
}: Props) {
  const accentX = 0 + (parallax?.x ?? 0) * 2
  const accentY = 74 + (parallax?.y ?? 0) * 2

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
        <rect x={accentX} y={accentY} width="22" height="22" fill={accentColor} opacity="0.92" />
      )}
      <path
        d="M 18 8 L 60 8 L 88 26 L 46 56 L 90 92 L 76 92 L 46 62 L 18 62 Z"
        fill={color}
      />
    </svg>
  )
}
