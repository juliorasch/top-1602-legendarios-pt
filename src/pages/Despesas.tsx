import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type ObraLite = Pick<Database['public']['Tables']['obras']['Row'], 'id' | 'descricao'>
type DespesaRow = Database['public']['Tables']['despesas']['Row']
type Despesa = DespesaRow & { obra: ObraLite | null }
type Editing = Despesa | 'new' | null
type Filtro = 'todas' | 'por_confirmar'

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPt = new Intl.DateTimeFormat('pt-PT')

function formatDate(d: string): string {
  return dataPt.format(new Date(d))
}

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [obras, setObras] = useState<ObraLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [obraFiltro, setObraFiltro] = useState<string>('')
  const [filtro, setFiltro] = useState<Filtro>('todas')

  async function load() {
    setLoading(true)
    setError(null)
    const [eDesp, eObras] = await Promise.all([
      supabase
        .from('despesas')
        .select('*, obra:obras(id, descricao)')
        .order('data', { ascending: false }),
      supabase.from('obras').select('id, descricao').order('created_at', { ascending: false }),
    ])
    if (eDesp.error) setError(eDesp.error.message)
    else if (eObras.error) setError(eObras.error.message)
    else {
      setDespesas((eDesp.data as Despesa[] | null) ?? [])
      setObras(eObras.data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const visiveis = useMemo(() => {
    return despesas.filter((d) => {
      if (obraFiltro && d.obra_id !== obraFiltro) return false
      if (filtro === 'por_confirmar' && d.confirmado_pelo_user) return false
      return true
    })
  }, [despesas, obraFiltro, filtro])

  const total = useMemo(
    () => visiveis.reduce((acc, d) => acc + Number(d.valor), 0),
    [visiveis],
  )

  const porConfirmarCount = useMemo(
    () => despesas.filter((d) => !d.confirmado_pelo_user).length,
    [despesas],
  )

  return (
    <div>
      <div className="flex items-start justify-between mb-12 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              06 — Lançamentos
            </span>
          </div>
          <h1 className="font-display text-4xl text-cream-bright leading-tight">
            Despesas <span className="italic text-gold">por obra.</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="shrink-0 border border-gold text-gold px-5 py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
        >
          Nova despesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-bg-card border border-line rounded-editorial p-5">
          <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3">
            Total filtrado
          </div>
          <div className="font-display text-2xl tabular-nums text-negative">
            {eur.format(total)}
          </div>
        </div>
        <div className="bg-bg-card border border-line rounded-editorial p-5">
          <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3">
            Por confirmar
          </div>
          <div className="font-display text-2xl tabular-nums text-gold">
            {porConfirmarCount}
          </div>
        </div>
        <div className="bg-bg-card border border-line rounded-editorial p-5">
          <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3">
            Lançamentos visíveis
          </div>
          <div className="font-display text-2xl tabular-nums text-cream-bright">
            {visiveis.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
            Filtrar por obra
          </span>
          <select
            value={obraFiltro}
            onChange={(e) => setObraFiltro(e.target.value)}
            className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.descricao.length > 60 ? `${o.descricao.slice(0, 60)}…` : o.descricao}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
            Estado
          </span>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
          >
            <option value="todas">Todas</option>
            <option value="por_confirmar">Apenas por confirmar</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-muted text-sm">A carregar…</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {visiveis.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setEditing(d)}
              className="w-full text-left bg-bg-card border border-line hover:border-gold rounded-editorial p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                  <div className="font-display text-cream-bright text-base leading-snug mb-1">
                    {d.descricao || <span className="italic text-muted">Sem descrição</span>}
                  </div>
                  {d.obra && (
                    <p className="text-gold-dim text-xs italic line-clamp-1">
                      Obra: {d.obra.descricao}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-negative tabular-nums font-display">
                    {eur.format(Number(d.valor))}
                  </div>
                  <div className="text-muted text-xs mt-1">{formatDate(d.data)}</div>
                </div>
              </div>
            </button>
          ))}

          {visiveis.length === 0 && (
            <p className="text-muted text-sm italic py-8 text-center">
              Sem despesas para os filtros actuais.
            </p>
          )}
        </div>
      )}

      {editing !== null && (
        <DespesaForm
          despesa={editing === 'new' ? null : editing}
          obras={obras}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

type FormProps = {
  despesa: Despesa | null
  obras: ObraLite[]
  onClose: () => void
  onSaved: () => void
}

function DespesaForm({ despesa, obras, onClose, onSaved }: FormProps) {
  const [obraId, setObraId] = useState(despesa?.obra_id ?? '')
  const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? '')
  const [nifFornecedor, setNifFornecedor] = useState(despesa?.nif_fornecedor ?? '')
  const [valor, setValor] = useState(despesa ? String(despesa.valor) : '')
  const [data, setData] = useState(despesa?.data ?? new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState(despesa?.descricao ?? '')
  const [categoria, setCategoria] = useState(despesa?.categoria ?? '')
  const [fotoUrl, setFotoUrl] = useState(despesa?.foto_url ?? '')
  const [confirmado, setConfirmado] = useState(despesa?.confirmado_pelo_user ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const valorNum = Number(valor.replace(',', '.'))
    if (Number.isNaN(valorNum) || valorNum < 0) {
      setError('Valor inválido.')
      setSaving(false)
      return
    }

    const payload = {
      obra_id: obraId || null,
      fornecedor: fornecedor.trim(),
      nif_fornecedor: nifFornecedor.trim() || null,
      valor: valorNum,
      data,
      descricao: descricao.trim() || null,
      categoria: categoria.trim() || null,
      foto_url: fotoUrl.trim() || null,
      confirmado_pelo_user: confirmado,
    }

    const result = despesa
      ? await supabase.from('despesas').update(payload).eq('id', despesa.id)
      : await supabase.from('despesas').insert(payload)

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  async function handleDelete() {
    if (!despesa) return
    if (!confirm('Apagar esta despesa? Esta acção não pode ser desfeita.')) return
    setSaving(true)
    const { error } = await supabase.from('despesas').delete().eq('id', despesa.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm flex items-center justify-center px-6 py-12 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-bg-card border border-line rounded-editorial p-8 max-h-[calc(100vh-6rem)] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            {despesa ? 'Editar despesa' : 'Nova despesa'}
          </span>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Obra
            </span>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
            >
              <option value="">— Sem obra associada —</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.descricao.length > 60 ? `${o.descricao.slice(0, 60)}…` : o.descricao}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Fornecedor
              </span>
              <input
                type="text"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                required
                placeholder="Ex: Leroy Merlin"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                NIF fornecedor
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={nifFornecedor}
                onChange={(e) => setNifFornecedor(e.target.value)}
                placeholder="123456789"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors tabular-nums"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Valor (€)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                placeholder="0,00"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors tabular-nums"
              />
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Data
              </span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Descrição
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Ex: Tinta + rolos para o quarto"
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Categoria
              </span>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Material, Ferramenta"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Foto / PDF (URL)
              </span>
              <input
                type="url"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://…"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="w-4 h-4 accent-gold"
            />
            <span className="text-[11px] tracking-editorial-wide uppercase text-cream">
              Confirmada pelo utilizador
            </span>
          </label>
        </div>

        {error && <p className="text-negative text-xs mt-4">{error}</p>}

        <div className="flex justify-between items-center gap-2 mt-8">
          {despesa ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-negative transition-colors disabled:opacity-50"
            >
              Apagar
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-muted px-4 py-3 text-[11px] tracking-editorial-wide uppercase hover:text-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="border border-gold text-gold px-6 py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gold"
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
