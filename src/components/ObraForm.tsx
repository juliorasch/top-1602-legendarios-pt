import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Estado = Database['public']['Enums']['obra_estado']
type Cliente = Pick<Database['public']['Tables']['clientes']['Row'], 'id' | 'nome'>
type OrcamentoLite = Pick<
  Database['public']['Tables']['orcamentos']['Row'],
  'id' | 'descricao' | 'valor' | 'cliente_id'
>
type ObraRow = Database['public']['Tables']['obras']['Row']

export const OBRA_ESTADOS: { value: Estado; label: string; accent: string }[] = [
  { value: 'por_arrancar', label: 'Por arrancar', accent: 'text-gold-dim' },
  { value: 'em_curso', label: 'Em curso', accent: 'text-gold' },
  { value: 'concluida', label: 'Concluída', accent: 'text-positive' },
]

type Props = {
  obra: ObraRow | null
  onClose: () => void
  onSaved: (obraId?: string) => void
}

export default function ObraForm({ obra, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoLite[]>([])
  const [clienteId, setClienteId] = useState(obra?.cliente_id ?? '')
  const [orcamentoId, setOrcamentoId] = useState(obra?.orcamento_id ?? '')
  const [descricao, setDescricao] = useState(obra?.descricao ?? '')
  const [valorContratado, setValorContratado] = useState(
    obra?.valor_contratado != null ? String(obra.valor_contratado) : '',
  )
  const [dataInicio, setDataInicio] = useState(obra?.data_inicio ?? '')
  const [prazo, setPrazo] = useState(obra?.prazo ?? '')
  const [estado, setEstado] = useState<Estado>(obra?.estado ?? 'por_arrancar')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nome')
      .order('nome')
      .then(({ data, error }) => {
        if (error) {
          setError(`Não foi possível carregar clientes: ${error.message}`)
          return
        }
        setClientes(data ?? [])
      })

    supabase
      .from('orcamentos')
      .select('id, descricao, valor, cliente_id')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(`Não foi possível carregar orçamentos: ${error.message}`)
          return
        }
        setOrcamentos(data ?? [])
      })
  }, [])

  const orcamentosFiltrados = useMemo(() => {
    if (!clienteId) return orcamentos
    return orcamentos.filter((o) => o.cliente_id === clienteId)
  }, [orcamentos, clienteId])

  function handleOrcamentoChange(id: string) {
    setOrcamentoId(id)
    if (!id) return
    const orc = orcamentos.find((o) => o.id === id)
    if (!orc) return
    if (!clienteId && orc.cliente_id) setClienteId(orc.cliente_id)
    if (!descricao.trim()) setDescricao(orc.descricao)
    if (!valorContratado) setValorContratado(String(orc.valor))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    let valorNum: number | null = null
    if (valorContratado.trim()) {
      const parsed = Number(valorContratado.replace(',', '.'))
      if (Number.isNaN(parsed) || parsed < 0) {
        setError('Valor inválido.')
        setSaving(false)
        return
      }
      valorNum = parsed
    }

    const payload = {
      cliente_id: clienteId || null,
      orcamento_id: orcamentoId || null,
      descricao: descricao.trim(),
      valor_contratado: valorNum,
      data_inicio: dataInicio || null,
      prazo: prazo || null,
      estado,
    }

    if (obra) {
      const { error } = await supabase.from('obras').update(payload).eq('id', obra.id)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      onSaved(obra.id)
    } else {
      const { data, error } = await supabase.from('obras').insert(payload).select('id').single()
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      onSaved(data?.id)
    }
  }

  async function handleDelete() {
    if (!obra) return
    if (!confirm('Apagar esta obra? Esta acção não pode ser desfeita.')) return
    setSaving(true)
    const { error } = await supabase.from('obras').delete().eq('id', obra.id)
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
            {obra ? 'Editar obra' : 'Nova obra'}
          </span>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Cliente
            </span>
            <select
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value)
                if (orcamentoId) {
                  const orc = orcamentos.find((o) => o.id === orcamentoId)
                  if (orc && orc.cliente_id !== e.target.value) setOrcamentoId('')
                }
              }}
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
            >
              <option value="">— Sem cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Orçamento de origem
            </span>
            <select
              value={orcamentoId}
              onChange={(e) => handleOrcamentoChange(e.target.value)}
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
            >
              <option value="">— Sem orçamento associado —</option>
              {orcamentosFiltrados.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.descricao.length > 60 ? `${o.descricao.slice(0, 60)}…` : o.descricao}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Descrição
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={3}
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Valor contratado (€)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={valorContratado}
                onChange={(e) => setValorContratado(e.target.value)}
                placeholder="0,00"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors tabular-nums"
              />
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Estado
              </span>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as Estado)}
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              >
                {OBRA_ESTADOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Data de início
              </span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Prazo
              </span>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
            </label>
          </div>
        </div>

        {error && <p className="text-negative text-xs mt-4">{error}</p>}

        <div className="flex justify-between items-center gap-2 mt-8">
          {obra ? (
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
