import { Link } from 'react-router-dom'

type Props = {
  /** Nome do outro mundo (ex: "Família" quando estás em Empresa). */
  destino: string
  /** Path do outro mundo. */
  para: string
}

/**
 * Barra superior pequena com 2 acções: voltar ao Hub OU saltar directamente
 * para o outro mundo (Empresa ↔ Família). Aparece no topo do Painel da
 * empresa e da página da Família para facilitar navegação rápida.
 */
export default function VoltarHub({ destino, para }: Props) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-line gap-3 flex-wrap">
      <Link
        to="/"
        className="group inline-flex items-center gap-2 text-muted hover:text-gold transition-colors text-[11px] tracking-editorial-wide uppercase"
      >
        <span className="text-gold text-base transition-transform group-hover:-translate-x-0.5">
          ←
        </span>
        Voltar ao Hub
      </Link>

      <Link
        to={para}
        className="group inline-flex items-center gap-2 text-muted hover:text-gold transition-colors text-[11px] tracking-editorial-wide uppercase"
      >
        Ir para {destino}
        <span className="text-gold text-base transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  )
}
