import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import DespesaForm from '@/components/DespesaForm'
import CapturaExpress from '@/components/CapturaExpress'
import VoltarHub from '@/components/VoltarHub'

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const mesAno = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
const dataPt = new Intl.DateTimeFormat('pt-PT')

type Alerta = {
  id: string
  href: string
  badge: string
  badgeAccent: string
  titulo: string
  detalhe: string
}

type Resumo = {
  orcamentosAbertos: number
  orcamentosAbertosValor: number
  obrasEmCurso: number
  obrasValorContratado: number
  despesasPorConfirmar: number
  decisoesPendentes: number
  decisoesAltaPrioridade: number
  alertas: Alerta[]
}

const RESUMO_VAZIO: Resumo = {
  orcamentosAbertos: 0,
  orcamentosAbertosValor: 0,
  obrasEmCurso: 0,
  obrasValorContratado: 0,
  despesasPorConfirmar: 0,
  decisoesPendentes: 0,
  decisoesAltaPrioridade: 0,
  alertas: [],
}

function diasAteHoje(d: string): number {
  const target = new Date(d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function descreverDias(dias: number): string {
  if (dias < 0) return `${Math.abs(dias)} dias atrás`
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias} dias`
}

export default function Painel() {
  const [resumo, setResumo] = useState<Resumo>(RESUMO_VAZIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capturando, setCapturando] = useState(false)
  const [fallbackForm, setFallbackForm] = useState(false)

  async function load() {
    const now = new Date()
    const hoje = now.toISOString().slice(0, 10)
    const limite = new Date(now)
    limite.setDate(limite.getDate() + 7)
    const limiteIso = limite.toISOString().slice(0, 10)

    setLoading(true)
    setError(null)
    try {
      const [
        orcamentos,
        obras,
        despesas,
        decisoes,
        orcamentosVencidos,
        decisoesAltaPendentes,
        obrasPrazoProximo,
      ] = await Promise.all([
        supabase.from('orcamentos').select('valor, estado'),
        supabase.from('obras').select('valor_contratado, estado'),
        supabase.from('despesas').select('confirmado_pelo_user'),
        supabase.from('decisoes').select('estado, prioridade'),
        supabase
          .from('orcamentos')
          .select('id, descricao, proximo_followup, cliente:clientes(nome)')
          .in('estado', ['enviado', 'em_analise'])
          .not('proximo_followup', 'is', null)
          .lte('proximo_followup', hoje)
          .order('proximo_followup', { ascending: true })
          .limit(5),
        supabase
          .from('decisoes')
          .select('id, titulo, prazo, prioridade')
          .eq('estado', 'pendente')
          .or(`prioridade.eq.alta,and(prazo.gte.${hoje},prazo.lte.${limiteIso}),prazo.lt.${hoje}`)
          .order('prazo', { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from('obras')
          .select('id, descricao, prazo')
          .eq('estado', 'em_curso')
          .not('prazo', 'is', null)
          .lte('prazo', limiteIso)
          .order('prazo', { ascending: true })
          .limit(5),
      ])

      const firstError =
        orcamentos.error ||
        obras.error ||
        despesas.error ||
        decisoes.error ||
        orcamentosVencidos.error ||
        decisoesAltaPendentes.error ||
        obrasPrazoProximo.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      const orcamentosAbertosLista =
        orcamentos.data?.filter((o) => o.estado === 'enviado' || o.estado === 'em_analise') ?? []
      const obrasEmCursoLista = obras.data?.filter((o) => o.estado === 'em_curso') ?? []

      const alertas: Alerta[] = []

      for (const o of (orcamentosVencidos.data ?? []) as Array<{
        id: string
        descricao: string
        proximo_followup: string
        cliente: { nome: string } | null
      }>) {
        const dias = diasAteHoje(o.proximo_followup)
        alertas.push({
          id: `o-${o.id}`,
          href: '/orcamentos',
          badge: 'Orçamento',
          badgeAccent: 'text-gold',
          titulo: o.cliente?.nome ? `${o.cliente.nome} — ${o.descricao}` : o.descricao,
          detalhe: `Follow-up ${descreverDias(dias).toLowerCase()} (${dataPt.format(new Date(o.proximo_followup))})`,
        })
      }

      for (const d of (decisoesAltaPendentes.data ?? []) as Array<{
        id: string
        titulo: string
        prazo: string | null
        prioridade: 'alta' | 'media' | 'baixa'
      }>) {
        const detalhe = d.prazo
          ? `Prazo ${descreverDias(diasAteHoje(d.prazo)).toLowerCase()} (${dataPt.format(new Date(d.prazo))})`
          : 'Sem prazo definido'
        alertas.push({
          id: `d-${d.id}`,
          href: '/decisoes',
          badge: d.prioridade === 'alta' ? 'Decisão · alta' : 'Decisão',
          badgeAccent: d.prioridade === 'alta' ? 'text-negative' : 'text-gold',
          titulo: d.titulo,
          detalhe,
        })
      }

      for (const o of (obrasPrazoProximo.data ?? []) as Array<{
        id: string
        descricao: string
        prazo: string
      }>) {
        const dias = diasAteHoje(o.prazo)
        alertas.push({
          id: `ob-${o.id}`,
          href: `/obras/${o.id}`,
          badge: 'Obra',
          badgeAccent: dias < 0 ? 'text-negative' : 'text-gold',
          titulo: o.descricao,
          detalhe: `Prazo ${descreverDias(dias).toLowerCase()} (${dataPt.format(new Date(o.prazo))})`,
        })
      }

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
        alertas: alertas.slice(0, 6),
      })
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const tituloMes = mesAno.format(new Date())

  return (
    <div>
      <VoltarHub destino="Família" para="/familia" />

      <div className="flex items-center gap-3 mb-3">
        <span className="block h-px w-7 bg-gold" />
        <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
          02 — Empresa
        </span>
      </div>
      <h1 className="font-display text-4xl text-cream-bright leading-tight mb-2">
        Rasch Remodeling <span className="italic text-gold">LDA.</span>
      </h1>
      <p className="text-muted text-sm italic mb-10 capitalize">{tituloMes}</p>

      {/* HERO: Capturar fatura — destaque máximo */}
      <button
        type="button"
        onClick={() => setCapturando(true)}
        className="group relative w-full bg-gradient-to-br from-bg-card to-bg-2 border border-line hover:border-gold rounded-editorial p-8 md:p-10 mb-10 transition-colors text-left overflow-hidden"
      >
        <div className="absolute right-6 top-6 opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-500">
          <svg viewBox="0 0 80 80" className="w-32 h-32" aria-hidden>
            <rect x="14" y="10" width="48" height="60" rx="2" fill="#C9A961" />
            <line x1="22" y1="22" x2="54" y2="22" stroke="#0E1F1D" strokeWidth="2" />
            <line x1="22" y1="32" x2="54" y2="32" stroke="#0E1F1D" strokeWidth="1.5" />
            <line x1="22" y1="40" x2="44" y2="40" stroke="#0E1F1D" strokeWidth="1.5" />
            <line x1="22" y1="48" x2="54" y2="48" stroke="#0E1F1D" strokeWidth="1.5" />
            <line x1="22" y1="56" x2="38" y2="56" stroke="#0E1F1D" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Atalho rápido
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-cream-bright leading-tight mb-2">
            Capturar <span className="italic text-gold">fatura.</span>
          </h2>
          <p className="text-muted text-sm leading-relaxed max-w-prose mb-6">
            Tira foto, faz upload de PDF ou imagem. A IA lê fornecedor, NIF,
            valor, itens linha-a-linha e sugere a obra. Tu confirmas e está
            guardado.
          </p>
          <span className="inline-flex items-center gap-2 border border-gold text-gold px-5 py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial group-hover:bg-gold group-hover:text-bg transition-colors">
            Tirar foto ou escolher ficheiro
            <span className="text-base">→</span>
          </span>
        </div>
      </button>

      {loading && <p className="text-muted text-sm">A carregar…</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && !error && resumo.alertas.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-line">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Atenção · {resumo.alertas.length}
            </span>
          </div>
          <div className="space-y-2">
            {resumo.alertas.map((a) => (
              <Link
                key={a.id}
                to={a.href}
                className="flex items-center justify-between gap-4 bg-bg-card border border-line hover:border-gold rounded-editorial p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] tracking-editorial-wide uppercase mb-1 ${a.badgeAccent}`}>
                    {a.badge}
                  </div>
                  <div className="text-cream-bright text-sm leading-snug line-clamp-1">
                    {a.titulo}
                  </div>
                </div>
                <div className="text-muted text-xs shrink-0 text-right">
                  {a.detalhe}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && (
        <>
          {/* KPIs em grid */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-line">
              <span className="block h-px w-7 bg-gold" />
              <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
                Indicadores
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                to="/orcamentos"
                label="Orçamentos abertos"
                valor={String(resumo.orcamentosAbertos)}
                detalhe={eur.format(resumo.orcamentosAbertosValor)}
              />
              <KpiCard
                to="/obras"
                label="Obras em curso"
                valor={String(resumo.obrasEmCurso)}
                detalhe={eur.format(resumo.obrasValorContratado)}
              />
              <KpiCard
                to="/despesas"
                label="Despesas por confirmar"
                valor={String(resumo.despesasPorConfirmar)}
                accent={resumo.despesasPorConfirmar > 0 ? 'text-gold' : 'text-cream-bright'}
              />
              <KpiCard
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

          {/* Atalhos para todas as secções */}
          <section>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-line">
              <span className="block h-px w-7 bg-gold" />
              <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
                Navegar
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Atalho to="/clientes" label="Clientes" />
              <Atalho to="/orcamentos" label="Orçamentos" />
              <Atalho to="/obras" label="Obras" />
              <Atalho to="/despesas" label="Despesas" />
              <Atalho to="/decisoes" label="Decisões" />
              <Atalho to="/relatorio" label="Relatório semanal" />
              <Atalho to="/familia" label="Família" muted />
              <Atalho to="/" label="← Hub" muted />
            </div>
          </section>
        </>
      )}

      {capturando && (
        <CapturaExpress
          onClose={() => setCapturando(false)}
          onSaved={(despesaId) => {
            setCapturando(false)
            if (despesaId === undefined) {
              // fallback: abrir form completo
              setFallbackForm(true)
            } else {
              load()
            }
          }}
        />
      )}

      {fallbackForm && (
        <DespesaForm
          despesa={null}
          autoCapture={false}
          onClose={() => setFallbackForm(false)}
          onSaved={async () => {
            setFallbackForm(false)
            await load()
          }}
        />
      )}
    </div>
  )
}

function KpiCard({
  to,
  label,
  valor,
  detalhe,
  accent = 'text-cream-bright',
}: {
  to: string
  label: string
  valor: string
  detalhe?: string
  accent?: string
}) {
  return (
    <Link
      to={to}
      className="block bg-bg-card border border-line hover:border-gold rounded-editorial p-5 transition-colors group"
    >
      <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3 group-hover:text-gold transition-colors">
        {label}
      </div>
      <div className={`font-display text-2xl md:text-3xl tabular-nums ${accent}`}>
        {valor}
      </div>
      {detalhe && <div className="text-muted text-xs mt-1">{detalhe}</div>}
    </Link>
  )
}

function Atalho({ to, label, muted }: { to: string; label: string; muted?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex items-center justify-between bg-bg-card border border-line hover:border-gold rounded-editorial px-4 py-3 transition-colors ${
        muted ? 'opacity-70' : ''
      }`}
    >
      <span className="text-[11px] tracking-editorial-wide uppercase text-cream group-hover:text-gold transition-colors">
        {label}
      </span>
      <span className="text-gold text-sm transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  )
}
