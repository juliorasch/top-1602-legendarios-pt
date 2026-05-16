import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ObraForm, { OBRA_ESTADOS } from '@/components/ObraForm'
import type { Database } from '@/types/database'

type Cliente = Pick<Database['public']['Tables']['clientes']['Row'], 'id' | 'nome'>
type ObraRow = Database['public']['Tables']['obras']['Row']
type Obra = ObraRow & {
  cliente: Cliente | null
  orcamento: Pick<Database['public']['Tables']['orcamentos']['Row'], 'id' | 'descricao'> | null
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPt = new Intl.DateTimeFormat('pt-PT')

function formatDate(d: string | null): string {
  if (!d) return '—'
  return dataPt.format(new Date(d))
}

export default function Obras() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('obras')
      .select('*, cliente:clientes(id, nome), orcamento:orcamentos(id, descricao)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setObras((data as Obra[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between mb-12 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              05 — Estaleiro
            </span>
          </div>
          <h1 className="font-display text-4xl text-cream-bright leading-tight">
            Obras <span className="italic text-gold">em curso.</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="shrink-0 border border-gold text-gold px-5 py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
        >
          Nova obra
        </button>
      </div>

      {loading && <p className="text-muted text-sm">A carregar…</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OBRA_ESTADOS.map((col) => {
            const list = obras.filter((o) => o.estado === col.value)
            return (
              <section key={col.value} className="bg-bg-2 border border-line rounded-editorial p-4 min-h-[180px]">
                <header className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                  <span className={`text-[11px] tracking-editorial-wide uppercase ${col.accent}`}>
                    {col.label}
                  </span>
                  <span className="text-muted text-[11px] tabular-nums">{list.length}</span>
                </header>

                <div className="space-y-3">
                  {list.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => navigate(`/obras/${o.id}`)}
                      className="w-full text-left bg-bg-card border border-line hover:border-gold rounded-editorial p-4 transition-colors"
                    >
                      <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-2">
                        {o.cliente?.nome ?? 'Sem cliente'}
                      </div>
                      <div className="font-display text-cream-bright text-base leading-snug mb-3 line-clamp-2">
                        {o.descricao}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gold tabular-nums">
                          {o.valor_contratado != null ? eur.format(Number(o.valor_contratado)) : '—'}
                        </span>
                        <span className="text-muted">Prazo: {formatDate(o.prazo)}</span>
                      </div>
                    </button>
                  ))}

                  {list.length === 0 && (
                    <p className="text-muted text-xs italic py-4 text-center">
                      Vazio
                    </p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {creating && (
        <ObraForm
          obra={null}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false)
            if (id) navigate(`/obras/${id}`)
            else load()
          }}
        />
      )}
    </div>
  )
}
