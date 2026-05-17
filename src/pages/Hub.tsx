import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const mesAno = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

type Stats = {
  orcamentosAbertos: number
  obrasEmCurso: number
  decisoesAlta: number
  despesasPorConfirmar: number
  saldoFamilia: number
  entradasFamilia: number
  despesasFamilia: number
}

const STATS_ZERO: Stats = {
  orcamentosAbertos: 0,
  obrasEmCurso: 0,
  decisoesAlta: 0,
  despesasPorConfirmar: 0,
  saldoFamilia: 0,
  entradasFamilia: 0,
  despesasFamilia: 0,
}

function monthBounds(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
  return { start, end }
}

type FixaLite = { descricao: string; valor: number; data: string }

function dedupeFixasPorDescricao(rows: FixaLite[]): FixaLite[] {
  const porChave = new Map<string, FixaLite>()
  for (const row of rows) {
    const chave = row.descricao.trim().toLowerCase()
    const existente = porChave.get(chave)
    if (!existente || row.data > existente.data) {
      porChave.set(chave, row)
    }
  }
  return [...porChave.values()]
}

export default function Hub() {
  const [stats, setStats] = useState<Stats>(STATS_ZERO)
  const [loading, setLoading] = useState(true)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    const { start, end } = monthBounds()
    Promise.all([
      supabase.from('orcamentos').select('estado'),
      supabase.from('obras').select('estado'),
      supabase.from('decisoes').select('estado, prioridade'),
      supabase.from('despesas').select('confirmado_pelo_user'),
      supabase.from('entradas_familia').select('valor').gte('data', start).lt('data', end),
      // Despesas familiares: variáveis do mês + todas as fixas activas até este mês.
      // Mesma lógica da página Família — assim os números batem certo.
      supabase
        .from('despesas_familia')
        .select('descricao, valor, tipo, data')
        .eq('tipo', 'variavel')
        .gte('data', start)
        .lt('data', end),
      supabase
        .from('despesas_familia')
        .select('descricao, valor, tipo, data')
        .eq('tipo', 'fixa')
        .lt('data', end),
    ])
      .then(([o, ob, d, de, eFam, dVar, dFix]) => {
        const entradasTotal =
          eFam.data?.reduce((a, r) => a + Number(r.valor), 0) ?? 0
        const variaveisTotal =
          dVar.data?.reduce((a, r) => a + Number(r.valor), 0) ?? 0
        const fixasUnicas = dedupeFixasPorDescricao(dFix.data ?? [])
        const fixasTotal = fixasUnicas.reduce((a, r) => a + Number(r.valor), 0)
        const despesasTotal = variaveisTotal + fixasTotal
        setStats({
          orcamentosAbertos:
            o.data?.filter(
              (x) => x.estado === 'enviado' || x.estado === 'em_analise',
            ).length ?? 0,
          obrasEmCurso: ob.data?.filter((x) => x.estado === 'em_curso').length ?? 0,
          decisoesAlta:
            d.data?.filter(
              (x) => x.estado === 'pendente' && x.prioridade === 'alta',
            ).length ?? 0,
          despesasPorConfirmar:
            de.data?.filter((x) => !x.confirmado_pelo_user).length ?? 0,
          entradasFamilia: entradasTotal,
          despesasFamilia: despesasTotal,
          saldoFamilia: entradasTotal - despesasTotal,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      setParallax({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const tituloMes = mesAno.format(new Date())

  return (
    <div className="relative -mx-6 -my-10 min-h-[calc(100vh-7rem)] overflow-hidden">
      <BackgroundPattern parallax={parallax} />

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-3 mb-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Hub
            </span>
            <span className="block h-px w-7 bg-gold" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-cream-bright leading-tight text-center">
            Onde queres <span className="italic text-gold">trabalhar.</span>
          </h1>
          <p className="text-muted text-sm italic mt-3 capitalize">{tituloMes}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 md:gap-8 max-w-4xl mx-auto">
          <HubTile
            numero="01"
            categoria="Negócio"
            titulo="Empresa"
            italic="LDA."
            descricao="Rasch Remodeling — clientes, orçamentos, obras, despesas."
            principal={
              loading ? '—' : `${stats.obrasEmCurso} obras em curso`
            }
            secundario={
              loading
                ? ' '
                : `${stats.orcamentosAbertos} orçamentos · ${stats.despesasPorConfirmar} despesas por confirmar`
            }
            alerta={stats.decisoesAlta > 0 ? `${stats.decisoesAlta} decisões prioritárias` : null}
            mark={<RaschMark parallax={parallax} />}
            onClick={() => navigate('/painel')}
            tilt={parallax}
            invert={false}
          />

          <HubTile
            numero="02"
            categoria="Lar"
            titulo="Família"
            italic="quotidiana."
            descricao="Vida pessoal — entradas, despesas fixas e variáveis."
            principal={loading ? '—' : eur.format(stats.saldoFamilia)}
            saldoPositivo={stats.saldoFamilia >= 0}
            secundario={
              loading
                ? ' '
                : `Entr ${eur.format(stats.entradasFamilia)} · Desp ${eur.format(stats.despesasFamilia)}`
            }
            alerta={null}
            mark={<FamiliaMark parallax={parallax} />}
            onClick={() => navigate('/familia')}
            tilt={parallax}
            invert={true}
          />
        </div>

        <p className="font-display italic text-muted text-sm mt-16 text-center tracking-wide">
          Trabalho bem feito constrói reputação sólida.
        </p>
      </div>
    </div>
  )
}

type TileProps = {
  numero: string
  categoria: string
  titulo: string
  italic: string
  descricao: string
  principal: string
  saldoPositivo?: boolean
  secundario: string
  alerta: string | null
  mark: React.ReactNode
  onClick: () => void
  tilt: { x: number; y: number }
  invert: boolean
}

function HubTile({
  numero,
  categoria,
  titulo,
  italic,
  descricao,
  principal,
  saldoPositivo,
  secundario,
  alerta,
  mark,
  onClick,
  tilt,
  invert,
}: TileProps) {
  const direction = invert ? -1 : 1
  const transform = `perspective(1000px) rotateY(${tilt.x * 3 * direction}deg) rotateX(${-tilt.y * 2}deg)`
  const principalColor =
    saldoPositivo === undefined
      ? 'text-cream-bright'
      : saldoPositivo
      ? 'text-positive'
      : 'text-negative'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[4/5] md:aspect-[5/6] w-full bg-bg-card border border-line hover:border-gold rounded-editorial p-7 md:p-10 transition-colors text-left overflow-hidden"
      style={{
        transform,
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* mark geométrico de fundo, grande e subtil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500 flex items-center justify-center"
        aria-hidden
      >
        <div className="w-3/4 h-3/4">{mark}</div>
      </div>

      {/* conteúdo */}
      <div className="relative h-full flex flex-col">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-display text-2xl text-gold-dim group-hover:text-gold transition-colors">
            {numero}
          </span>
          <span className="block h-px w-7 bg-gold-dim group-hover:bg-gold transition-colors" />
          <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim group-hover:text-gold transition-colors">
            {categoria}
          </span>
        </div>

        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-cream-bright leading-none mb-3">
          {titulo}
          <br />
          <span className="italic text-gold">{italic}</span>
        </h2>

        <p className="text-muted text-sm leading-relaxed max-w-prose mb-auto">
          {descricao}
        </p>

        <div className="mt-auto pt-6">
          <div className={`font-display text-2xl md:text-3xl tabular-nums ${principalColor}`}>
            {principal}
          </div>
          <p className="text-muted text-xs mt-1 leading-relaxed">{secundario}</p>

          {alerta && (
            <p className="mt-3 text-negative text-[11px] tracking-editorial-wide uppercase">
              · {alerta}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-line group-hover:border-gold transition-colors">
          <span className="text-[11px] tracking-editorial-wide uppercase text-muted group-hover:text-gold transition-colors">
            Entrar
          </span>
          <span className="text-gold text-xl transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </button>
  )
}

function RaschMark({ parallax }: { parallax: { x: number; y: number } }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <g fill="#C9A961">
        <path d="M 16 10 L 70 10 L 86 26 L 86 50 L 50 50 L 50 62 L 16 62 Z" />
        <path d="M 50 50 L 64 50 L 92 92 L 78 92 Z" />
      </g>
      <rect
        x={2 + parallax.x * 2}
        y={68 + parallax.y * 2}
        width="22"
        height="22"
        fill="#5A7A7E"
        opacity="0.92"
      />
    </svg>
  )
}

function FamiliaMark({ parallax }: { parallax: { x: number; y: number } }) {
  // Dois quadrados sobrepostos com offset — duas vidas que se cruzam.
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect
        x={14}
        y={14}
        width="58"
        height="58"
        fill="#C9A961"
        opacity="0.85"
      />
      <rect
        x={32 - parallax.x * 2}
        y={32 - parallax.y * 2}
        width="58"
        height="58"
        fill="#5A7A7E"
        opacity="0.9"
      />
    </svg>
  )
}

function BackgroundPattern({ parallax }: { parallax: { x: number; y: number } }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.05]"
      style={{
        transform: `translate(${parallax.x * 14}px, ${parallax.y * 14}px)`,
        transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      aria-hidden
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hub-dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#C9A961" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hub-dots)" />
      </svg>
    </div>
  )
}
