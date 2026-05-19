import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type Status = 'a-validar' | 'pronto' | 'invalido' | 'a-gravar' | 'sucesso'

export default function ResetSenha() {
  const [status, setStatus] = useState<Status>('a-validar')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true

    // O Supabase JS detecta automaticamente o token no hash da URL e cria
    // sessão temporária + dispara evento PASSWORD_RECOVERY. Esperamos esse
    // evento OU a sessão já existente.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY') setStatus('pronto')
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) {
        setStatus('pronto')
      } else {
        // Damos um pequeno tempo ao Supabase para processar o hash
        setTimeout(() => {
          if (!alive) return
          supabase.auth.getSession().then(({ data: data2 }) => {
            if (!alive) return
            setStatus(data2.session ? 'pronto' : 'invalido')
          })
        }, 1200)
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('A palavra-passe tem de ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As palavras-passe não coincidem.')
      return
    }
    setStatus('a-gravar')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message || 'Não foi possível gravar a nova palavra-passe.')
      setStatus('pronto')
      return
    }
    setStatus('sucesso')
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg flex items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            01 — Nova palavra-passe
          </span>
          <span className="block h-px w-7 bg-gold" />
        </div>

        <h1 className="font-display text-3xl text-cream-bright leading-tight text-center mb-2">
          Define a tua nova <span className="italic text-gold">palavra-passe.</span>
        </h1>
        <p className="text-muted text-xs tracking-wide text-center mb-10">
          Escolhe algo seguro. Pelo menos 8 caracteres.
        </p>

        {status === 'a-validar' && (
          <p className="text-muted text-[11px] tracking-editorial-wide uppercase text-center">
            A validar link…
          </p>
        )}

        {status === 'invalido' && (
          <div className="text-center space-y-4 py-4">
            <p className="text-negative text-sm">
              Link inválido ou expirado.
            </p>
            <p className="text-muted text-xs leading-relaxed">
              Volta ao login e pede um novo link.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="text-gold hover:text-cream-bright text-[11px] tracking-editorial-wide uppercase transition-colors"
            >
              ← Voltar ao login
            </button>
          </div>
        )}

        {(status === 'pronto' || status === 'a-gravar' || status === 'sucesso') && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="Nova palavra-passe"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              disabled={status !== 'pronto'}
            />
            <Field
              label="Confirma a palavra-passe"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              disabled={status !== 'pronto'}
            />

            {error && (
              <p
                className="text-negative text-xs tracking-wide text-center animate-pulse"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status !== 'pronto'}
              className="group relative w-full mt-4 overflow-hidden border border-gold text-gold py-3.5 text-[11px] tracking-editorial-wide uppercase rounded-editorial transition-all duration-300 hover:text-bg disabled:opacity-50"
            >
              <span
                className={`absolute inset-0 bg-gold transition-transform duration-500 ${
                  status === 'a-gravar' || status === 'sucesso'
                    ? 'translate-x-0'
                    : '-translate-x-full group-hover:translate-x-0'
                }`}
              />
              <span className="relative">
                {status === 'sucesso'
                  ? 'Pronto'
                  : status === 'a-gravar'
                  ? 'A gravar…'
                  : 'Gravar nova palavra-passe'}
              </span>
            </button>

            {status === 'sucesso' && (
              <p className="text-positive text-xs tracking-wide text-center">
                ✦ Palavra-passe actualizada. A entrar…
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <label className="block">
      <span
        className={`text-[11px] tracking-editorial-wide uppercase block mb-2 transition-colors ${
          focused ? 'text-gold' : 'text-gold-dim'
        }`}
      >
        {label}
      </span>
      <div className="relative">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="w-full bg-bg-card/60 backdrop-blur-sm border border-line rounded-editorial px-4 py-3.5 text-cream-bright text-sm outline-none transition-all focus:border-gold focus:bg-bg-card focus:shadow-[0_0_0_3px_rgba(201,169,97,0.08)] disabled:opacity-50"
        />
        <span
          className={`pointer-events-none absolute left-0 bottom-0 h-px bg-gold transition-all duration-500 ${
            focused ? 'w-full opacity-100' : 'w-0 opacity-0'
          }`}
        />
      </div>
    </label>
  )
}
