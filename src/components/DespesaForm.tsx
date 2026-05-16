import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  deleteFatura,
  isStoragePath,
  resolveFotoUrl,
  uploadFatura,
} from '@/lib/storage'
import type { Database } from '@/types/database'

type ObraLite = Pick<Database['public']['Tables']['obras']['Row'], 'id' | 'descricao'> & {
  cliente: { nome: string } | null
}
type DespesaRow = Database['public']['Tables']['despesas']['Row']

type AnaliseIA = {
  fornecedor?: string
  nif_fornecedor?: string | null
  data?: string
  valor?: number
  categoria?: string | null
  itens?: { descricao: string; valor: number }[]
  obra_sugerida_id?: string | null
  confianca?: number
}

type Props = {
  despesa: DespesaRow | null
  onClose: () => void
  onSaved: () => void
  /**
   * Quando true, abre directamente o picker de ficheiro/câmara (modo
   * "captura rápida" a partir do Painel ou Hub).
   */
  autoCapture?: boolean
}

export default function DespesaForm({ despesa, onClose, onSaved, autoCapture }: Props) {
  const [obras, setObras] = useState<ObraLite[]>([])
  const [obraId, setObraId] = useState(despesa?.obra_id ?? '')
  const [obraHint, setObraHint] = useState('')
  const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? '')
  const [nifFornecedor, setNifFornecedor] = useState(despesa?.nif_fornecedor ?? '')
  const [valor, setValor] = useState(despesa ? String(despesa.valor) : '')
  const [data, setData] = useState(despesa?.data ?? new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState(despesa?.descricao ?? '')
  const [categoria, setCategoria] = useState(despesa?.categoria ?? '')
  const [fotoUrl, setFotoUrl] = useState(despesa?.foto_url ?? '')
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(despesa?.confirmado_pelo_user ?? true)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [analiseInfo, setAnaliseInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carrega obras (com cliente) para o dropdown + fuzzy match da hint.
  useEffect(() => {
    supabase
      .from('obras')
      .select('id, descricao, cliente:clientes(nome)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return
        setObras((data as ObraLite[] | null) ?? [])
      })
  }, [])

  // Fuzzy match da hint contra obras — corre sempre que hint OU obras mudam.
  // A hint do user prevalece sobre a sugestão da IA.
  useEffect(() => {
    const hint = obraHint.trim().toLowerCase()
    if (!hint || obras.length === 0) return
    const match = obras.find((o) => {
      const desc = o.descricao.toLowerCase()
      const cli = o.cliente?.nome.toLowerCase() ?? ''
      return desc.includes(hint) || cli.includes(hint)
    })
    if (match) setObraId(match.id)
  }, [obraHint, obras])

  // Auto-trigger do picker se autoCapture estiver activo.
  useEffect(() => {
    if (autoCapture && !fotoUrl) {
      // pequena espera para garantir que o input está montado
      const t = setTimeout(() => fileInputRef.current?.click(), 100)
      return () => clearTimeout(t)
    }
  }, [autoCapture, fotoUrl])

  useEffect(() => {
    let cancelled = false
    if (!fotoUrl) {
      setFotoPreviewUrl(null)
      return
    }
    resolveFotoUrl(fotoUrl).then((url) => {
      if (!cancelled) setFotoPreviewUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [fotoUrl])

  async function handleFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    setError(null)
    try {
      if (fotoUrl && isStoragePath(fotoUrl)) {
        await deleteFatura(fotoUrl).catch(() => undefined)
      }
      const path = await uploadFatura(file)
      setFotoUrl(path)
      setAnaliseInfo(null)
      // SEMPRE auto-analisa após upload — a IA é o coração da feature.
      setTimeout(() => analisarFotoCom(path), 300)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploadingFoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoverFoto() {
    if (!fotoUrl) return
    setError(null)
    if (isStoragePath(fotoUrl)) {
      await deleteFatura(fotoUrl).catch(() => undefined)
    }
    setFotoUrl('')
    setAnaliseInfo(null)
  }

  async function analisarFotoCom(path: string) {
    if (!path || !isStoragePath(path)) return
    setAnalisando(true)
    setError(null)
    setAnaliseInfo(null)
    try {
      const { data: out, error: fnError } = await supabase.functions.invoke<
        AnaliseIA & { error?: string }
      >('analisar-fatura', { body: { fotoPath: path } })
      if (fnError) throw fnError
      if (!out || out.error) throw new Error(out?.error ?? 'Sem resposta.')

      // Aplicar tudo agressivamente — a IA é a fonte primária. Se o utilizador
      // já tinha editado algo manualmente, fica como estava (preserva edição).
      if (out.fornecedor && !fornecedor.trim()) setFornecedor(out.fornecedor)
      if (out.nif_fornecedor && !nifFornecedor.trim()) setNifFornecedor(out.nif_fornecedor)
      if (typeof out.valor === 'number' && !valor) setValor(String(out.valor))
      if (out.data) setData(out.data)
      if (out.categoria && !categoria.trim()) setCategoria(out.categoria)
      // Obra: sempre que a IA sugere uma válida, aplicamos (mesmo que haja uma
      // anterior — sugestão da IA prevalece, user corrige se errado).
      if (out.obra_sugerida_id) {
        const existe = obras.some((o) => o.id === out.obra_sugerida_id)
        if (existe) setObraId(out.obra_sugerida_id)
      }
      if (out.itens && out.itens.length > 0 && !descricao.trim()) {
        setDescricao(
          out.itens
            .map((it) => `${it.descricao} — ${it.valor.toFixed(2)}€`)
            .join('\n'),
        )
      }
      setConfirmado(false)
      const conf = typeof out.confianca === 'number'
        ? ` · confiança ${(out.confianca * 100).toFixed(0)}%`
        : ''
      const obraDetectada = out.obra_sugerida_id
        ? obras.find((o) => o.id === out.obra_sugerida_id)
        : null
      const obraInfo = obraDetectada
        ? ` · obra: ${obraDetectada.descricao.slice(0, 40)}`
        : out.obra_sugerida_id === null
          ? ' · sem obra associada'
          : ''
      setAnaliseInfo(`IA processou${conf}${obraInfo}. Revê e guarda.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na análise.')
    } finally {
      setAnalisando(false)
    }
  }

  async function handleAnalisar() {
    await analisarFotoCom(fotoUrl)
  }

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
            {despesa ? 'Editar despesa' : autoCapture ? 'Capturar fatura' : 'Nova despesa'}
          </span>
        </div>

        <div className="space-y-5">
          {/* Captura da fatura em DESTAQUE no topo */}
          <div>
            <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
              Fatura (foto ou ficheiro)
            </span>

            {fotoPreviewUrl ? (
              <div className="border border-line rounded-editorial overflow-hidden bg-bg">
                <div className="relative">
                  <img
                    src={fotoPreviewUrl}
                    alt="Fatura"
                    className="w-full max-h-72 object-contain bg-bg-deep"
                  />
                  {analisando && (
                    <div className="absolute inset-0 bg-bg-deep/85 flex flex-col items-center justify-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                        <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                      </div>
                      <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
                        IA a analisar…
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-line gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAnalisar}
                    disabled={analisando || !isStoragePath(fotoUrl)}
                    className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors disabled:opacity-50"
                    title="Voltar a analisar com IA"
                  >
                    ↻ Re-analisar
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoverFoto}
                    className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-negative transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-line hover:border-gold rounded-editorial py-8 px-4 cursor-pointer transition-colors bg-bg">
                <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
                  {uploadingFoto ? 'A carregar…' : 'Tirar foto, escolher da galeria ou ficheiro'}
                </span>
                <span className="text-muted text-xs italic text-center">
                  No telemóvel: câmara OU galeria. No computador: qualquer
                  ficheiro. IA analisa automaticamente. JPG, PNG ou PDF.
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFotoChange}
                  disabled={uploadingFoto}
                  className="hidden"
                />
              </label>
            )}

            {analiseInfo && (
              <p className="text-positive text-xs italic mt-2 flex items-center gap-2">
                <span className="text-gold">✦</span>
                {analiseInfo}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Para que obra? <span className="normal-case italic text-muted">(dica rápida)</span>
              </span>
              <input
                type="text"
                value={obraHint}
                onChange={(e) => setObraHint(e.target.value)}
                placeholder="ex: Catarina, cozinha, telhado…"
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              />
              <span className="text-muted text-xs italic mt-1 block">
                Escreve nome do cliente, parte da obra, o que vier à cabeça —
                fazemos match com a lista abaixo.
              </span>
            </label>

            <label className="block">
              <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim block mb-2">
                Obra associada
              </span>
              <select
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors"
              >
                <option value="">— Sem obra associada —</option>
                {obras.map((o) => {
                  const cli = o.cliente?.nome ? `${o.cliente.nome} — ` : ''
                  const label = `${cli}${o.descricao}`
                  return (
                    <option key={o.id} value={o.id}>
                      {label.length > 60 ? `${label.slice(0, 60)}…` : label}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>

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
              rows={3}
              placeholder="Ex: Tinta + rolos para o quarto"
              className="w-full bg-bg border border-line focus:border-gold rounded-editorial px-4 py-3 text-cream-bright text-sm outline-none transition-colors resize-none"
            />
          </label>

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
