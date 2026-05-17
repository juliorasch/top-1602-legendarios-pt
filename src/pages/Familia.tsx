import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import VoltarHub from '@/components/VoltarHub'
import type { Database } from '@/types/database'

type TipoDespesa = Database['public']['Enums']['despesa_familia_tipo']
type Entrada = Database['public']['Tables']['entradas_familia']['Row']
type Despesa = Database['public']['Tables']['despesas_familia']['Row']

type Kind = 'entrada' | 'despesa'
type Editing =
  | { kind: 'entrada'; row: Entrada | null }
  | { kind: 'despesa'; row: Despesa | null }
  | null

const TIPOS_DESPESA: { value: TipoDespesa; label: string }[] = [
  { value: 'fixa', label: 'Fixa' },
  { value: 'variavel', label: 'Variável' },
]

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPt = new Intl.DateTimeFormat('pt-PT')
const mesAno = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })

function formatDate(d: string): string {
  return dataPt.format(new Date(d))
}

function monthBounds(ref: Date): { start: string; end: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

function dedupeFixas(rows: Despesa[]): Despesa[] {
  // Fixas duplicadas (legacy de quando se clonava do mês anterior) podem
  // inflacionar o total. Agrupa por descrição (case-insensitive) e fica
  // com a mais recente — assumida como fonte de verdade.
  const porChave = new Map<string, Despesa>()
  for (const row of rows) {
    const chave = row.descricao.trim().toLowerCase()
    const existente = porChave.get(chave)
    if (!existente || row.data > existente.data) {
      porChave.set(chave, row)
    }
  }
  return [...porChave.values()].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, 'pt'),
  )
}

export default function Familia() {
  const [ref, setRef] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [tab, setTab] = useState<Kind>('despesa')

  const { start, end } = useMemo(() => monthBounds(ref), [ref])

  async function load() {
    setLoading(true)
    setError(null)

    const [eEntradas, eVariaveis, eFixas] = await Promise.all([
      // Entradas — só deste mês.
      supabase
        .from('entradas_familia')
        .select('*')
        .gte('data', start)
        .lt('data', end)
        .order('data', { ascending: false }),
      // Despesas variáveis — só deste mês.
      supabase
        .from('despesas_familia')
        .select('*')
        .eq('tipo', 'variavel')
        .gte('data', start)
        .lt('data', end)
        .order('data', { ascending: false }),
      // Despesas FIXAS — todas as que começaram em qualquer mês até este
      // (inclusive). Aparecem em todos os meses para sempre.
      supabase
        .from('despesas_familia')
        .select('*')
        .eq('tipo', 'fixa')
        .lt('data', end)
        .order('descricao', { ascending: true }),
    ])

    if (eEntradas.error) {
      setError(eEntradas.error.message)
    } else if (eVariaveis.error) {
      setError(eVariaveis.error.message)
    } else if (eFixas.error) {
      setError(eFixas.error.message)
    } else {
      setEntradas(eEntradas.data ?? [])
      // Dedupe: se houver várias fixas com a mesma descrição (legacy de
      // quando se clonava entre meses), fica só a mais recente.
      const fixasUnicas = dedupeFixas(eFixas.data ?? [])
      setDespesas([...fixasUnicas, ...(eVariaveis.data ?? [])])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end])

  const totais = useMemo(() => {
    const tEntradas = entradas.reduce((acc, r) => acc + Number(r.valor), 0)
    const tDespesas = despesas.reduce((acc, r) => acc + Number(r.valor), 0)
    return { entradas: tEntradas, despesas: tDespesas, saldo: tEntradas - tDespesas }
  }, [entradas, despesas])

  // Agrupar despesas por tipo (fixa / variável), com subtotais.
  const despesasFixas = useMemo(
    () => despesas.filter((d) => d.tipo === 'fixa'),
    [despesas],
  )
  const despesasVariaveis = useMemo(
    () => despesas.filter((d) => d.tipo === 'variavel'),
    [despesas],
  )
  const totalFixas = useMemo(
    () => despesasFixas.reduce((a, d) => a + Number(d.valor), 0),
    [despesasFixas],
  )
  const totalVariaveis = useMemo(
    () => despesasVariaveis.reduce((a, d) => a + Number(d.valor), 0),
    [despesasVariaveis],
  )

  function changeMonth(delta: number) {
    setRef((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const tituloMes = mesAno.format(ref)

  return (
    <div>
      <VoltarHub destino="Empresa" para="/painel" />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            08 — Mordomia
          </span>
        </div>
        <h1 className="font-display text-4xl text-cream-bright leading-tight">
          Vida <span className="italic text-gold">familiar.</span>
        </h1>
      </div>

      {/* HERO: adicionar despesa/entrada com 1 toque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setEditing({ kind: 'despesa', row: null })}
          className="group flex items-center justify-between gap-4 bg-bg-card border border-line hover:border-gold rounded-editorial p-5 transition-colors text-left"
        >
          <div>
            <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim group-hover:text-gold transition-colors mb-1">
              Adicionar
            </div>
            <div className="font-display text-xl text-cream-bright leading-tight">
              Nova <span className="italic text-gold">despesa.</span>
            </div>
          </div>
          <span className="text-gold text-2xl transition-transform group-hover:translate-x-1">
            →
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEditing({ kind: 'entrada', row: null })}
          className="group flex items-center justify-between gap-4 bg-bg-card border border-line hover:border-gold rounded-editorial p-5 transition-colors text-left"
        >
          <div>
            <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim group-hover:text-gold transition-colors mb-1">
              Adicionar
            </div>
            <div className="font-display text-xl text-cream-bright leading-tight">
              Nova <span className="italic text-positive">entrada.</span>
            </div>
          </div>
          <span className="text-gold text-2xl transition-transform group-hover:translate-x-1">
            →
          </span>
        </button>
      </div>

      {/* Dica didáctica — como funciona Fixas vs Variáveis */}
      <div className="border border-line rounded-editorial p-4 mb-6 bg-bg-card/40">
        <div className="flex items-start gap-3">
          <span className="text-gold text-base shrink-0 mt-0.5">✦</span>
          <div className="text-muted text-xs leading-relaxed">
            <span className="text-cream">Fixas</span> aparecem
            automaticamente em todos os meses (Netflix, renda, seguros).
            Para alterar uma fixa, edita-a — muda para sempre. <br />
            <span className="text-cream">Variáveis</span> são lançadas por
            mês (supermercado, gasolina, restaurantes). Adiciona à medida
            que aparecem.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="text-muted hover:text-gold text-[11px] tracking-editorial-wide uppercase transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-cream-bright font-display italic text-lg capitalize">
          {tituloMes}
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="text-muted hover:text-gold text-[11px] tracking-editorial-wide uppercase transition-colors"
        >
          Próximo →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <SumarioCard label="Entradas" valor={totais.entradas} accent="text-positive" />
        <SumarioCard label="Despesas" valor={totais.despesas} accent="text-negative" />
        <SumarioCard
          label="Saldo"
          valor={totais.saldo}
          accent={totais.saldo >= 0 ? 'text-positive' : 'text-negative'}
        />
      </div>

      <div className="flex items-center gap-6 mb-6 pb-3 border-b border-line">
        {(['despesa', 'entrada'] as Kind[]).map((k) => {
          const isActive = tab === k
          const count = k === 'entrada' ? entradas.length : despesas.length
          const label = k === 'entrada' ? 'Entradas' : 'Despesas'
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`text-[11px] tracking-editorial-wide uppercase pb-2 transition-colors border-b-2 ${
                isActive ? 'text-gold border-gold' : 'text-muted border-transparent hover:text-cream'
              }`}
            >
              {label} <span className="text-muted tabular-nums ml-1">({count})</span>
            </button>
          )
        })}
      </div>

      {loading && <p className="text-muted text-sm">A carregar…</p>}
      {error && <p className="text-negative text-sm">{error}</p>}

      {!loading && !error && tab === 'despesa' && (
        <div className="space-y-10">
          <GrupoDespesas
            titulo="Fixas"
            subtitulo="contas recorrentes — todos os meses"
            items={despesasFixas}
            total={totalFixas}
            accent="text-gold"
            onEdit={(d) => setEditing({ kind: 'despesa', row: d })}
            emptyText="Sem despesas fixas registadas neste mês."
          />
          <GrupoDespesas
            titulo="Variáveis"
            subtitulo="gastos pontuais — só este mês"
            items={despesasVariaveis}
            total={totalVariaveis}
            accent="text-gold-dim"
            onEdit={(d) => setEditing({ kind: 'despesa', row: d })}
            emptyText="Sem despesas variáveis neste mês."
          />
          {despesas.length === 0 && (
            <p className="text-muted text-sm italic py-8 text-center">
              Sem despesas neste mês. Clica em "Nova despesa" no topo.
            </p>
          )}
        </div>
      )}

      {!loading && !error && tab === 'entrada' && (
        <div className="space-y-3">
          {entradas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEditing({ kind: 'entrada', row: e })}
              className="w-full text-left bg-bg-card border border-line hover:border-gold rounded-editorial p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {e.categoria && (
                      <span className="text-muted text-[11px] tracking-editorial-wide uppercase">
                        {e.categoria}
                      </span>
                    )}
                    {e.recorrente && (
                      <span className="text-gold-dim text-[11px] tracking-editorial-wide uppercase">
                        {e.categoria ? '· ' : ''}Recorrente
                      </span>
                    )}
                  </div>
                  <div className="font-display text-cream-bright text-base leading-snug">
                    {e.descricao}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-positive tabular-nums font-display">
                    {eur.format(Number(e.valor))}
                  </div>
                  <div className="text-muted text-xs mt-1">{formatDate(e.data)}</div>
                </div>
              </div>
            </button>
          ))}
          {entradas.length === 0 && (
            <p className="text-muted text-sm italic py-8 text-center">
              Sem entradas neste mês.
            </p>
          )}
        </div>
      )}

      {editing !== null && (
        <FamiliaForm
          editing={editing}
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

function GrupoDespesas({
  titulo,
  subtitulo,
  items,
  total,
  accent,
  onEdit,
  emptyText,
}: {
  titulo: string
  subtitulo: string
  items: Despesa[]
  total: number
  accent: string
  onEdit: (d: Despesa) => void
  emptyText: string
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-4 pb-3 border-b border-line">
        <div>
          <div className="flex items-center gap-3">
            <span className="block h-px w-7 bg-gold" />
            <span className={`text-[11px] tracking-editorial-wide uppercase ${accent}`}>
              {titulo}
            </span>
            <span className="text-muted text-[11px] tabular-nums">({items.length})</span>
          </div>
          <p className="text-muted text-xs italic mt-1 pl-10">{subtitulo}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-1">
            Subtotal
          </div>
          <div className="font-display text-xl tabular-nums text-negative">
            {eur.format(total)}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-sm italic py-4 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onEdit(d)}
              className="w-full text-left bg-bg-card border border-line hover:border-gold rounded-editorial p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-cream-bright text-base leading-snug">
                    {d.descricao}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {d.categoria && (
                      <span className="text-muted text-[11px] tracking-editorial-wide uppercase">
                        {d.categoria}
                      </span>
                    )}
                    {d.recorrente && (
                      <span className="text-gold-dim text-[11px] tracking-editorial-wide uppercase">
                        {d.categoria ? '· ' : ''}Recorrente
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-negative tabular-nums font-display">
                    {eur.format(Number(d.valor))}
                  </div>
                  <div className="text-muted text-xs mt-1">
                    {d.tipo === 'fixa' ? 'Mensal' : formatDate(d.data)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function SumarioCard({
  label,
  valor,
  accent,
}: {
  label: string
  valor: number
  accent: string
}) {
  return (
    <div className="bg-bg-card border border-line rounded-editorial p-5">
      <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-3">
        {label}
      </div>
      <div className={`font-display text-2xl tabular-nums ${accent}`}>
        {eur.format(valor)}
      </div>
    </div>
  )
}

type FormProps = {
  editing: NonNullable<Editing>
  onClose: () => void
  onSaved: () => void
}

function FamiliaForm({ editing, onClose, onSaved }: FormProps) {
  const isDespesa = editing.kind === 'despesa'
  const row = editing.row

  const [descricao, setDescricao] = useState(row?.descricao ?? '')
  const [valor, setValor] = useState(row ? String(row.valor) : '')
  const [categoria, setCategoria] = useState(row?.categoria ?? '')
  const [data, setData] = useState(row?.data ?? new Date().toISOString().slice(0, 10))
  const [recorrente, setRecorrente] = useState(row?.recorrente ?? false)
  const [tipo, setTipo] = useState<TipoDespesa>(
    editing.kind === 'despesa' ? (editing.row?.tipo ?? 'variavel') : 'variavel',
  )
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

    const base = {
      descricao: descricao.trim(),
      valor: valorNum,
      categoria: categoria.trim() || null,
      data,
      recorrente,
    }

    let result
    if (editing.kind === 'despesa') {
      const payload = { ...base, tipo }
      result = editing.row
        ? await supabase.from('despesas_familia').update(payload).eq('id', editing.row.id)
        : await supabase.from('despesas_familia').insert(payload)
    } else {
      result = editing.row
        ? await supabase.from('entradas_familia').update(base).eq('id', editing.row.id)
        : await supabase.from('entradas_familia').insert(base)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  async function handleDelete() {
    if (!editing.row) return
    if (!confirm('Apagar este lançamento? Esta acção não pode ser desfeita.')) return
    setSaving(true)
    const table = editing.kind === 'despesa' ? 'despesas_familia' : 'entradas_familia'
    const { error } = await supabase.from(table).delete().eq('id', editing.row.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  const titulo = row
    ? isDespesa ? 'Editar despesa' : 'Editar entrada'
    : isDespesa ? 'Nova despesa' : 'Nova entrada'

  return (
    <div className="fixed inset-0 bg-bg-deep/80 backdrop-blur-sm flex items-center justify-center px-6 py-12 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-bg-card border border-line rounded-editorial p-8 max-h-[calc(100vh-6rem)] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            {titulo}
          </span>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Descrição
            </span>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
            />
          </label>

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

          {isDespesa && (
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Tipo
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDespesa)}
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              >
                {TIPOS_DESPESA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Categoria
            </span>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Mercado, Renda, Salário…"
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="w-4 h-4 accent-gold"
            />
            <span className="text-[11px] tracking-editorial-wide uppercase text-cream">
              Lançamento recorrente
            </span>
          </label>
        </div>

        {error && <p className="text-negative text-xs mt-4">{error}</p>}

        <div className="flex justify-between items-center gap-2 mt-8">
          {row ? (
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
