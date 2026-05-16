import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const mesAno = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

type Resumo = {
  orcamentosAbertos: number
  orcamentosAbertosValor: number
  obrasEmCurso: number
  obrasValorContratado: number
  despesasPorConfirmar: number
  decisoesPendentes: number
  decisoesAltaPrioridade: number
  saldoFamiliar: number
  entradasFamilia: number
  despesasFamilia: number
}

const RESUMO_VAZIO: Resumo = {
  orcamentosAbertos: 0,
  orcamentosAbertosValor: 0,
  obrasEmCurso: 0,
  obrasValorContratado: 0,
  despesasPorConfirmar: 0,
  decisoesPendentes: 0,
  decisoesAltaPrioridade: 0,
  saldoFamiliar: 0,
  entradasFamilia: 0,
  despesasFamilia: 0,
}

function monthBounds(ref: Date): { start: string; end: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

export default function Painel() {
  const [resumo, setResumo] = useState<Resumo>(RESUMO_VAZIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const { start, end } = monthBounds(now)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [
          orcamentos,
          obras,
          despesas,
          decisoes,
          entradas,
          despesasFam,
        ] = await Promise.all([
          supabase.from('orcamentos').select('valor, estado'),
          supabase.from('obras').select('valor_contratado, estado'),
          supabase.from('despesas').select('confirmado_pelo_user'),
          supabase.from('decisoes').select('estado, prioridade'),
          supabase
            .from('entradas_familia')
            .select('valor')
            .gte('data', start)
            .lt('data', end),
          supabase
            .from('despesas_familia')
            .select('valor')
            .gte('data', start)
            .lt('data', end),
        ])

        const firstError =
          orcamentos.error ||
          obras.error ||
          despesas.error ||
          decisoes.error ||
          entradas.error ||
          despesasFam.error
        if (firstError) {
          setError(firstError.message)
          setLoading(false)
          return
        }

        const orcamentosAbertosLista =
          orcamentos.data?.filter((o) => o.estado === 'enviado' || o.estado === 'em_analise') ?? []
        const obrasEmCursoLista = obras.data?.filter((o) => o.estado === 'em_curso') ?? []
        const entradasTotal = entradas.data?.reduce((a, r) => a + Number(r.valor), 0) ?? 0
        const despesasFamTotal = despesasFam.data?.reduce((a, r) => a + Number(r.valor), 0) ?? 0

        setResumo({
          orcamentosAbertos: orcamentosAbertosLista.length,
          orcamentosAbertosValor: orcamentosAbertosLista.reduce((a, r) => a + Number(r.valor), 0),
          obrasEmCurso: obrasEmCursoLista.length,
          obrasValorContratado: obrasEmCursoLista.reduce(
            (a, r) => a + Number(r.valor_contratado ?? 0),
            0,
          ),
          despesasPorConfirmar:
            despesas.data?.filter((d) => !d.confirmado_pelo_user).length ?? 0,
          decisoesPendentes:
            decisoes.data?.filter((d) => d.estado === 'pendente').length ?? 0,
          decisoesAltaPrioridade:
            decisoes.data?.filter(
              (d) => d.estado === 'pendente' && d.prioridade === 'alta',
            ).length ?? 0,
          entradasFamilia: entradasTotal,
          despesasFamilia: despesasFamTotal,
          saldoFamiliar: entradasTotal - despesasFamTotal,
        })
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro inesperado.')
        setLoading(false)
      }
    }

    load()
  }, [])

  const tituloMes = mesAno.format(new Date())
  const saldoAccent = resumo.saldoFamiliar >= 0 ? 'text-positive' : 'text-negative'

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="block h-px w-7 bg-gold" />
        <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
          02 — Painel
        </span>
      </div>
      <h1 className="font-display text-4xl text-cream-bright leading-tight mb-2">
        Visão <span className="italic text-gold">geral.</span>
      </h1>
      <p className="text-muted text-sm italic mb-12 capitalize">
        {tituloMes}
      </p>

      {loading && <p className="text-muted text-sm">A carregar…</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-bg-card border border-line rounded-editorial p-8">
            <div className="text-gold text-[11px] tracking-editorial-wide uppercase mb-4">
              Empresa
            </div>
            <p className="font-display text-2xl text-cream-bright leading-tight mb-8">
              Rasch Remodeling <span className="italic text-gold">LDA.</span>
            </p>

            <div className="space-y-5">
              <PainelLinha
                to="/orcamentos"
                label="Orçamentos no pipeline"
                valor={String(resumo.orcamentosAbertos)}
                detalhe={eur.format(resumo.orcamentosAbertosValor)}
              />
              <PainelLinha
                to="/obras"
                label="Obras em curso"
                valor={String(resumo.obrasEmCurso)}
                detalhe={eur.format(resumo.obrasValorContratado)}
              />
              <PainelLinha
                to="/despesas"
                label="Despesas por confirmar"
                valor={String(resumo.despesasPorConfirmar)}
                accent={resumo.despesasPorConfirmar > 0 ? 'text-gold' : 'text-cream-bright'}
              />
              <PainelLinha
                to="/decisoes"
                label="Decisões pendentes"
                valor={String(resumo.decisoesPendentes)}
                detalhe={
                  resumo.decisoesAltaPrioridade > 0
                    ? `${resumo.decisoesAltaPrioridade} alta prioridade`
                    : undefined
                }
                accent={resumo.decisoesAltaPrioridade > 0 ? 'text-negative' : 'text-cream-bright'}
              />
            </div>
          </section>

          <section className="bg-bg-card border border-line rounded-editorial p-8">
            <div className="text-gold text-[11px] tracking-editorial-wide uppercase mb-4">
              Família
            </div>
            <Link to="/familia" className="block group">
              <p className="font-display text-2xl text-cream-bright leading-tight mb-1 group-hover:text-gold transition-colors">
                Saldo <span className="italic text-gold">familiar.</span>
              </p>
              <p className="text-muted text-xs italic capitalize mb-8">{tituloMes}</p>

              <div className={`font-display text-4xl tabular-nums mb-8 ${saldoAccent}`}>
                {eur.format(resumo.saldoFamiliar)}
              </div>
            </Link>

            <div className="space-y-5">
              <PainelLinha
                to="/familia"
                label="Entradas do mês"
                valor={eur.format(resumo.entradasFamilia)}
                accent="text-positive"
              />
              <PainelLinha
                to="/familia"
                label="Despesas do mês"
                valor={eur.format(resumo.despesasFamilia)}
                accent="text-negative"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

type LinhaProps = {
  to: string
  label: string
  valor: string
  detalhe?: string
  accent?: string
}

function PainelLinha({ to, label, valor, detalhe, accent = 'text-cream-bright' }: LinhaProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-4 pb-4 border-b border-line group hover:border-gold transition-colors"
    >
      <div className="min-w-0">
        <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim group-hover:text-gold transition-colors">
          {label}
        </div>
        {detalhe && <div className="text-muted text-xs mt-1">{detalhe}</div>}
      </div>
      <div className={`font-display text-xl tabular-nums shrink-0 ${accent}`}>
        {valor}
      </div>
    </Link>
  )
}
