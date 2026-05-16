import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ObraForm, { OBRA_ESTADOS } from '@/components/ObraForm'
import type { Database } from '@/types/database'

type ObraRow = Database['public']['Tables']['obras']['Row']
type Cliente = Pick<Database['public']['Tables']['clientes']['Row'], 'id' | 'nome'>
type OrcamentoLite = Pick<
  Database['public']['Tables']['orcamentos']['Row'],
  'id' | 'descricao' | 'valor'
>
type Obra = ObraRow & {
  cliente: Cliente | null
  orcamento: OrcamentoLite | null
}
type Despesa = Database['public']['Tables']['despesas']['Row']
type Decisao = Database['public']['Tables']['decisoes']['Row']

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPt = new Intl.DateTimeFormat('pt-PT')

function formatDate(d: string | null): string {
  if (!d) return '—'
  return dataPt.format(new Date(d))
}

function daysUntil(d: string | null): number | null {
  if (!d) return null
  const target = new Date(d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function estadoMeta(value: ObraRow['estado']) {
  return OBRA_ESTADOS.find((s) => s.value === value)!
}

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [obra, setObra] = useState<Obra | null>(null)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [decisoes, setDecisoes] = useState<Decisao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const [oRes, dRes, decRes] = await Promise.all([
      supabase
        .from('obras')
        .select('*, cliente:clientes(id, nome), orcamento:orcamentos(id, descricao, valor)')
        .eq('id', id)
        .single(),
      supabase
        .from('despesas')
        .select('*')
        .eq('obra_id', id)
        .order('data', { ascending: false }),
      supabase
        .from('decisoes')
        .select('*')
        .eq('obra_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (oRes.error) {
      setError(oRes.error.message)
      setLoading(false)
      return
    }
    setObra(oRes.data as Obra)
    setDespesas(dRes.data ?? [])
    setDecisoes(decRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const totalDespesas = useMemo(
    () => despesas.reduce((acc, d) => acc + Number(d.valor), 0),
    [despesas],
  )
  const valorContratado = Number(obra?.valor_contratado ?? 0)
  const margem = valorContratado - totalDespesas
  const margemPct = valorContratado > 0 ? (margem / valorContratado) * 100 : null
  const diasPrazo = daysUntil(obra?.prazo ?? null)
  const pendentes = decisoes.filter((d) => d.estado === 'pendente').length
  const porConfirmar = despesas.filter((d) => !d.confirmado_pelo_user).length

  if (loading) {
    return <p className="text-muted text-sm">A carregar…</p>
  }
  if (error) {
    return <p className="text-negative text-sm">{error}</p>
  }
  if (!obra) {
    return <p className="text-muted text-sm">Obra não encontrada.</p>
  }

  const estMeta = estadoMeta(obra.estado)

  return (
    <div>
      <Link
        to="/obras"
        className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors inline-block mb-6"
      >
        ← Estaleiro
      </Link>

      <div className="flex items-start justify-between mb-12 gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="block h-px w-7 bg-gold" />
            <span className={`text-[11px] tracking-editorial-wide uppercase ${estMeta.accent}`}>
              {estMeta.label}
            </span>
            {obra.cliente && (
              <span className="text-muted text-[11px] tracking-editorial-wide uppercase">
                · {obra.cliente.nome}
              </span>
            )}
          </div>
          <h1 className="font-display text-4xl text-cream-bright leading-tight max-w-prose">
            {obra.descricao}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 border border-gold text-gold px-5 py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
        >
          Editar obra
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Valor contratado"
          value={valorContratado > 0 ? eur.format(valorContratado) : '—'}
        />
        <StatCard
          label="Total despesas"
          value={eur.format(totalDespesas)}
          accent="text-negative"
        />
        <StatCard
          label="Margem actual"
          value={valorContratado > 0 ? eur.format(margem) : '—'}
          accent={
            valorContratado === 0 ? 'text-cream-bright' : margem >= 0 ? 'text-positive' : 'text-negative'
          }
          detalhe={
            margemPct != null
              ? `${margemPct.toFixed(0)}% do contratado`
              : undefined
          }
        />
        <StatCard
          label="Prazo"
          value={formatDate(obra.prazo)}
          detalhe={
            diasPrazo == null
              ? undefined
              : diasPrazo < 0
              ? `${Math.abs(diasPrazo)} dias atrás`
              : diasPrazo === 0
              ? 'Hoje'
              : `Em ${diasPrazo} dias`
          }
          accent={
            diasPrazo == null ? 'text-cream-bright' : diasPrazo < 0 ? 'text-negative' : 'text-cream-bright'
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <InfoCard label="Cliente" value={obra.cliente?.nome ?? '—'} />
        <InfoCard
          label="Orçamento de origem"
          value={obra.orcamento?.descricao ?? '—'}
        />
        <InfoCard label="Data de início" value={formatDate(obra.data_inicio)} />
        <InfoCard label="Estado" value={estMeta.label} accent={estMeta.accent} />
      </div>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Despesas ligadas ({despesas.length})
            </span>
            {porConfirmar > 0 && (
              <span className="text-gold-dim text-[11px] tracking-editorial-wide uppercase">
                · {porConfirmar} por confirmar
              </span>
            )}
          </div>
          <Link
            to="/despesas"
            className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors"
          >
            Ver todas →
          </Link>
        </div>

        <div className="space-y-3">
          {despesas.map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-4 bg-bg-card border border-line rounded-editorial p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim">
                    {d.fornecedor}
                  </span>
                  {d.categoria && (
                    <span className="text-muted text-[11px] tracking-editorial-wide uppercase">
                      · {d.categoria}
                    </span>
                  )}
                  {!d.confirmado_pelo_user && (
                    <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
                      · Por confirmar
                    </span>
                  )}
                </div>
                <div className="text-cream-bright text-sm leading-snug line-clamp-1">
                  {d.descricao || <span className="italic text-muted">Sem descrição</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-negative tabular-nums font-display text-sm">
                  {eur.format(Number(d.valor))}
                </div>
                <div className="text-muted text-xs mt-1">{formatDate(d.data)}</div>
              </div>
            </div>
          ))}
          {despesas.length === 0 && (
            <p className="text-muted text-sm italic py-4 text-center">
              Sem despesas ligadas a esta obra.
            </p>
          )}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Decisões ({decisoes.length})
            </span>
            {pendentes > 0 && (
              <span className="text-gold-dim text-[11px] tracking-editorial-wide uppercase">
                · {pendentes} pendentes
              </span>
            )}
          </div>
          <Link
            to="/decisoes"
            className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors"
          >
            Ver todas →
          </Link>
        </div>

        <div className="space-y-3">
          {decisoes.map((d) => {
            const resolvida = d.estado === 'resolvida'
            const prio = d.prioridade
            const accent =
              prio === 'alta' ? 'text-negative' : prio === 'media' ? 'text-gold' : 'text-gold-dim'
            return (
              <div
                key={d.id}
                className="bg-bg-card border border-line rounded-editorial p-4"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-[11px] tracking-editorial-wide uppercase ${accent}`}>
                    {prio === 'alta' ? 'Alta' : prio === 'media' ? 'Média' : 'Baixa'}
                  </span>
                  {resolvida && (
                    <span className="text-positive text-[11px] tracking-editorial-wide uppercase">
                      · Resolvida
                    </span>
                  )}
                  {d.prazo && (
                    <span className="text-muted text-xs ml-auto">
                      Prazo: {formatDate(d.prazo)}
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm leading-snug ${
                    resolvida ? 'text-muted line-through' : 'text-cream-bright'
                  }`}
                >
                  {d.titulo}
                </div>
              </div>
            )
          })}
          {decisoes.length === 0 && (
            <p className="text-muted text-sm italic py-4 text-center">
              Sem decisões ligadas a esta obra.
            </p>
          )}
        </div>
      </section>

      {editing && (
        <ObraForm
          obra={obra}
          onClose={() => setEditing(false)}
          onSaved={(savedId) => {
            setEditing(false)
            if (!savedId) {
              navigate('/obras')
              return
            }
            load()
          }}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  detalhe,
  accent = 'text-cream-bright',
}: {
  label: string
  value: string
  detalhe?: string
  accent?: string
}) {
  return (
    <div className="bg-bg-card border border-line rounded-editorial p-5">
      <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3">
        {label}
      </div>
      <div className={`font-display text-xl tabular-nums ${accent}`}>{value}</div>
      {detalhe && <div className="text-muted text-xs mt-1">{detalhe}</div>}
    </div>
  )
}

function InfoCard({
  label,
  value,
  accent = 'text-cream-bright',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div>
      <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-2">
        {label}
      </div>
      <div className={`text-sm leading-snug ${accent}`}>{value}</div>
    </div>
  )
}
