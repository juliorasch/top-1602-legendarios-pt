import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { deleteFatura, resolveFotoUrl, uploadFatura } from '@/lib/storage'
import type { Database } from '@/types/database'

type ObraLite = Pick<Database['public']['Tables']['obras']['Row'], 'id' | 'descricao'> & {
  cliente: { nome: string } | null
}

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

type Step = 'pick' | 'uploading' | 'analyzing' | 'saving' | 'done' | 'error' | 'fallback'

// Estados em que a foto ainda não está ligada a uma despesa — se o user
// fechar o modal nestes, há que limpar o ficheiro no storage.
const STEPS_FOTO_ORFA: Step[] = ['analyzing', 'saving', 'error', 'fallback']

type Props = {
  onClose: () => void
  onSaved: (despesaId?: string) => void
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export default function CapturaExpress({ onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('pick')
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<AnaliseIA | null>(null)
  const [savedDespesaId, setSavedDespesaId] = useState<string | null>(null)
  const [obraSelecionada, setObraSelecionada] = useState<ObraLite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Abre o picker automaticamente ao montar.
  useEffect(() => {
    const t = setTimeout(() => fileInputRef.current?.click(), 100)
    return () => clearTimeout(t)
  }, [])

  // Preview da foto carregada.
  useEffect(() => {
    if (!fotoPath) {
      setFotoPreviewUrl(null)
      return
    }
    let cancelled = false
    resolveFotoUrl(fotoPath).then((url) => {
      if (!cancelled) setFotoPreviewUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [fotoPath])

  async function discardFoto(path: string | null): Promise<void> {
    if (!path) return
    await deleteFatura(path).catch(() => undefined)
  }

  function handleClose() {
    // Se a foto não chegou a ser ligada a uma despesa, apaga-a para não
    // deixar lixo no storage.
    if (STEPS_FOTO_ORFA.includes(step) && fotoPath) {
      void discardFoto(fotoPath)
    }
    onClose()
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      // User cancelou o picker — fecha modal.
      onClose()
      return
    }
    setError(null)

    try {
      // 1. Upload
      setStep('uploading')
      const path = await uploadFatura(file)
      setFotoPath(path)

      // 2. Análise IA
      setStep('analyzing')
      const { data: ai, error: fnError } = await supabase.functions.invoke<
        AnaliseIA & { error?: string }
      >('analisar-fatura', { body: { fotoPath: path } })
      if (fnError) throw fnError
      if (!ai || (ai as { error?: string }).error)
        throw new Error((ai as { error?: string })?.error ?? 'Sem resposta da IA.')

      setExtracted(ai)

      // 3. Validar campos mínimos para auto-save.
      if (!ai.fornecedor || !ai.fornecedor.trim() || typeof ai.valor !== 'number') {
        // IA não extraiu o essencial — cair para fallback (form normal).
        // A foto vai ser perdida porque o DespesaForm pede novo upload;
        // limpa-se aqui para evitar órfã no storage.
        await discardFoto(path)
        setFotoPath(null)
        setStep('fallback')
        return
      }

      // 4. Resolver obra: usar a sugestão da IA, se houver.
      const obras = await fetchObrasEmCurso()
      let obraId: string | null = null
      if (ai.obra_sugerida_id) {
        const existe = obras.find((o) => o.id === ai.obra_sugerida_id)
        if (existe) obraId = existe.id
      }
      if (obraId) {
        setObraSelecionada(obras.find((o) => o.id === obraId) ?? null)
      }

      // 5. Auto-save
      setStep('saving')
      const descricaoFinal = ai.itens && ai.itens.length > 0
        ? ai.itens.map((it) => `${it.descricao} — ${it.valor.toFixed(2)}€`).join('\n')
        : null

      const payload = {
        obra_id: obraId,
        fornecedor: ai.fornecedor.trim(),
        nif_fornecedor: ai.nif_fornecedor?.trim() ?? null,
        valor: ai.valor,
        data: ai.data || new Date().toISOString().slice(0, 10),
        descricao: descricaoFinal,
        categoria: ai.categoria?.trim() ?? null,
        foto_url: path,
        confirmado_pelo_user: false,
      }

      const { data: saved, error: saveError } = await supabase
        .from('despesas')
        .insert(payload)
        .select('id')
        .single()

      if (saveError) throw saveError
      setSavedDespesaId(saved?.id ?? null)
      setStep('done')
    } catch (err) {
      // Algo falhou após upload — a despesa não foi guardada. Limpa a foto
      // imediatamente para não acumular lixo se o user clicar "Fechar".
      if (fotoPath) {
        await discardFoto(fotoPath)
        setFotoPath(null)
      }
      setError(err instanceof Error ? err.message : String(err))
      setStep('error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function fetchObrasEmCurso(): Promise<ObraLite[]> {
    const { data } = await supabase
      .from('obras')
      .select('id, descricao, cliente:clientes(nome)')
      .eq('estado', 'em_curso')
    return (data as ObraLite[] | null) ?? []
  }

  return (
    <div className="fixed inset-0 bg-bg-deep/85 backdrop-blur-sm flex items-center justify-center px-4 py-8 z-50">
      <div className="w-full max-w-md bg-bg-card border border-line rounded-editorial p-7 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="block h-px w-7 bg-gold" />
            <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
              Captura express
            </span>
          </div>
          {step !== 'uploading' && step !== 'analyzing' && step !== 'saving' && (
            <button
              type="button"
              onClick={handleClose}
              className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-cream"
            >
              ✕
            </button>
          )}
        </div>

        {/* PICK: o picker abre sozinho. Se o user cancelar, dá-se uma porta
            de saída para voltar a abrir sem fechar o modal. */}
        {step === 'pick' && (
          <>
            <h2 className="font-display text-2xl text-cream-bright mb-3">
              A abrir <span className="italic text-gold">câmara…</span>
            </h2>
            <p className="text-muted text-sm mb-6">
              Tira foto da fatura ou escolhe da galeria. O resto é automático.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-gold text-gold py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
            >
              Abrir câmara / galeria
            </button>
          </>
        )}

        {/* PROGRESSO */}
        {(step === 'uploading' || step === 'analyzing' || step === 'saving') && (
          <div className="py-8">
            {fotoPreviewUrl && (
              <div className="relative mb-6 border border-line rounded-editorial overflow-hidden bg-bg">
                <img
                  src={fotoPreviewUrl}
                  alt="Fatura"
                  className="w-full max-h-56 object-contain bg-bg-deep"
                />
                <div className="absolute inset-0 bg-bg-deep/70 flex flex-col items-center justify-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                    <span className="w-2 h-2 bg-gold rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
            )}
            <p className="text-center text-gold text-[11px] tracking-editorial-wide uppercase">
              {step === 'uploading' && 'A enviar foto…'}
              {step === 'analyzing' && 'IA a analisar…'}
              {step === 'saving' && 'A guardar…'}
            </p>
          </div>
        )}

        {/* SUCESSO */}
        {step === 'done' && extracted && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-positive text-2xl">✓</span>
              <h2 className="font-display text-2xl text-cream-bright">
                Despesa <span className="italic text-gold">guardada.</span>
              </h2>
            </div>

            {fotoPreviewUrl && (
              <img
                src={fotoPreviewUrl}
                alt="Fatura"
                className="w-full max-h-44 object-contain bg-bg-deep border border-line rounded-editorial mb-4"
              />
            )}

            <div className="space-y-2 mb-6">
              <Row label="Fornecedor" value={extracted.fornecedor ?? '—'} />
              {extracted.nif_fornecedor && (
                <Row label="NIF" value={extracted.nif_fornecedor} mono />
              )}
              <Row
                label="Valor"
                value={
                  typeof extracted.valor === 'number' ? eur.format(extracted.valor) : '—'
                }
                accent="text-negative"
              />
              {extracted.data && <Row label="Data" value={extracted.data} mono />}
              {extracted.categoria && (
                <Row label="Categoria" value={extracted.categoria} />
              )}
              {obraSelecionada && (
                <Row
                  label="Obra"
                  value={
                    obraSelecionada.cliente?.nome
                      ? `${obraSelecionada.cliente.nome} — ${obraSelecionada.descricao}`
                      : obraSelecionada.descricao
                  }
                  accent="text-gold"
                />
              )}
              {!obraSelecionada && (
                <Row label="Obra" value="Sem obra associada" muted />
              )}
              {extracted.itens && extracted.itens.length > 0 && (
                <div className="pt-3">
                  <div className="text-[11px] tracking-editorial-wide uppercase text-gold-dim mb-2">
                    Itens · {extracted.itens.length}
                  </div>
                  <ul className="space-y-1">
                    {extracted.itens.slice(0, 5).map((it, i) => (
                      <li
                        key={i}
                        className="text-cream text-xs flex items-baseline justify-between gap-2"
                      >
                        <span className="line-clamp-1">{it.descricao}</span>
                        <span className="tabular-nums shrink-0 text-muted">
                          {it.valor.toFixed(2)}€
                        </span>
                      </li>
                    ))}
                    {extracted.itens.length > 5 && (
                      <li className="text-muted text-xs italic">
                        + {extracted.itens.length - 5} itens
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {typeof extracted.confianca === 'number' && (
                <p className="text-muted text-xs italic pt-3">
                  Confiança da IA: {(extracted.confianca * 100).toFixed(0)}%
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link
                to="/despesas"
                onClick={() => onSaved(savedDespesaId ?? undefined)}
                className="flex-1 border border-gold text-gold px-4 py-3 text-center text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
              >
                Ver na lista
              </Link>
              <button
                type="button"
                onClick={() => onSaved(savedDespesaId ?? undefined)}
                className="flex-1 text-muted px-4 py-3 text-center text-[11px] tracking-editorial-wide uppercase hover:text-cream transition-colors"
              >
                Capturar outra
              </button>
            </div>
          </div>
        )}

        {/* ERRO */}
        {step === 'error' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-negative text-2xl">⚠</span>
              <h2 className="font-display text-2xl text-cream-bright">
                Não consegui <span className="italic text-negative">processar.</span>
              </h2>
            </div>
            <p className="text-muted text-sm mb-2">A IA falhou com este erro:</p>
            <p className="text-negative text-xs bg-bg p-3 rounded-editorial border border-line mb-6 font-mono break-all">
              {error}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full border border-gold text-gold py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
            >
              Fechar
            </button>
          </div>
        )}

        {/* FALLBACK: IA não extraiu o essencial */}
        {step === 'fallback' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-gold text-2xl">!</span>
              <h2 className="font-display text-2xl text-cream-bright">
                Falta info — <span className="italic text-gold">edita à mão.</span>
              </h2>
            </div>
            <p className="text-muted text-sm mb-6">
              A IA não conseguiu extrair os campos mínimos (fornecedor e valor).
              Abre o formulário completo para preencher.
            </p>
            <button
              type="button"
              onClick={() => onSaved(undefined)}
              className="w-full border border-gold text-gold py-3 text-[11px] tracking-editorial-wide uppercase rounded-editorial hover:bg-gold hover:text-bg transition-colors"
            >
              Abrir formulário
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  accent = 'text-cream-bright',
  mono,
  muted,
}: {
  label: string
  value: string
  accent?: string
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line">
      <span className="text-[11px] tracking-editorial-wide uppercase text-gold-dim shrink-0">
        {label}
      </span>
      <span
        className={`text-sm text-right ${muted ? 'text-muted italic' : accent} ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
