export default function App() {
  return (
    <div className="min-h-screen bg-bg text-cream flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            01 — Boas-vindas
          </span>
        </div>

        <h1 className="font-display text-5xl md:text-6xl text-cream-bright leading-[1.05]">
          Daily <span className="italic text-gold">Rasch.</span>
        </h1>

        <p className="mt-6 text-muted text-sm leading-relaxed">
          Plataforma de gestão integrada da Rasch Remodeling LDA.
          Empresa e família, num só sítio.
        </p>

        <div className="mt-12 pt-6 border-t border-line">
          <p className="font-display italic text-cream-bright text-base">
            Trabalho bem feito constrói reputação sólida.
          </p>
        </div>
      </div>
    </div>
  )
}
