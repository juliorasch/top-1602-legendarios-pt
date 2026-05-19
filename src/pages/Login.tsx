import { type FormEvent, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'reset'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [logoHover, setLogoHover] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const w = window.innerWidth
      const h = window.innerHeight
      setParallax({
        x: (e.clientX / w - 0.5) * 2,
        y: (e.clientY / h - 0.5) * 2,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) {
        setError('Credenciais inválidas. Tenta de novo.')
        setSubmitting(false)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Não foi possível ligar ao servidor. Verifica a ligação.')
      setSubmitting(false)
    }
  }

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-senha`,
      })
      if (result.error) {
        setError('Não foi possível enviar o email. Verifica o endereço.')
        setSubmitting(false)
      } else {
        setResetSent(true)
        setSubmitting(false)
      }
    } catch {
      setError('Não foi possível ligar ao servidor. Verifica a ligação.')
      setSubmitting(false)
    }
  }

  function switchToReset() {
    setMode('reset')
    setError(null)
    setResetSent(false)
    setPassword('')
  }

  function switchToLogin() {
    setMode('login')
    setError(null)
    setResetSent(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-bg flex items-center justify-center px-6 py-12"
    >
      <PatternBackground parallax={parallax} />

      <div
        className={`relative w-full max-w-md transition-all duration-700 ${
          success ? 'opacity-0 scale-95 -translate-y-4' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 mb-6 justify-center">
          <span className="block h-px w-7 bg-gold" />
          <span className="text-gold text-[11px] tracking-editorial-wide uppercase">
            {mode === 'reset' ? '01 — Recuperar acesso' : '01 — Entrada'}
          </span>
          <span className="block h-px w-7 bg-gold" />
        </div>

        <RaschMark hover={logoHover} success={success} parallax={parallax} />

        <div
          className="flex flex-col items-center mt-8"
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
        >
          <h1 className="font-display text-5xl text-cream-bright leading-none tracking-tight">
            Rasch<span className="italic text-gold">.</span>
          </h1>
          <span className="mt-2 text-cream text-[11px] tracking-editorial-wide uppercase">
            Daily — Plataforma Privada
          </span>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="mt-12 space-y-5">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <Field
              label="Palavra-passe"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
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
              disabled={submitting || success}
              className="group relative w-full mt-4 overflow-hidden border border-gold text-gold py-3.5 text-[11px] tracking-editorial-wide uppercase rounded-editorial transition-all duration-300 hover:text-bg disabled:opacity-50"
            >
              <span
                className={`absolute inset-0 bg-gold transition-transform duration-500 ${
                  submitting || success
                    ? 'translate-x-0'
                    : '-translate-x-full group-hover:translate-x-0'
                }`}
              />
              <span className="relative">
                {success ? 'Bem-vindo' : submitting ? 'A abrir…' : 'Entrar'}
              </span>
            </button>

            <button
              type="button"
              onClick={switchToReset}
              className="block mx-auto text-muted hover:text-gold text-[11px] tracking-editorial-wide uppercase transition-colors pt-2"
            >
              Esqueci a palavra-passe
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetRequest} className="mt-12 space-y-5">
            {resetSent ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-cream-bright text-sm leading-relaxed">
                  Enviámos um link para <span className="text-gold">{email}</span>.
                </p>
                <p className="text-muted text-xs leading-relaxed">
                  Verifica a tua caixa de entrada (e a pasta de spam, por via das
                  dúvidas). O link abre uma página para definires uma nova
                  palavra-passe.
                </p>
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="block mx-auto text-gold hover:text-cream-bright text-[11px] tracking-editorial-wide uppercase transition-colors pt-4"
                >
                  ← Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <p className="text-cream text-xs leading-relaxed text-center">
                  Escreve o teu email. Vamos enviar-te um link para definires uma
                  nova palavra-passe.
                </p>
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  required
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
                  disabled={submitting}
                  className="group relative w-full mt-4 overflow-hidden border border-gold text-gold py-3.5 text-[11px] tracking-editorial-wide uppercase rounded-editorial transition-all duration-300 hover:text-bg disabled:opacity-50"
                >
                  <span
                    className={`absolute inset-0 bg-gold transition-transform duration-500 ${
                      submitting
                        ? 'translate-x-0'
                        : '-translate-x-full group-hover:translate-x-0'
                    }`}
                  />
                  <span className="relative">
                    {submitting ? 'A enviar…' : 'Enviar link'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={switchToLogin}
                  className="block mx-auto text-muted hover:text-gold text-[11px] tracking-editorial-wide uppercase transition-colors pt-2"
                >
                  ← Voltar ao login
                </button>
              </>
            )}
          </form>
        )}

        <p className="font-display italic text-muted text-sm mt-14 text-center tracking-wide">
          Trabalho bem feito constrói reputação sólida.
        </p>
      </div>
    </div>
  )
}

function PatternBackground({ parallax }: { parallax: { x: number; y: number } }) {
  // Pattern geométrico de pontos + linhas que ecoam o R — duas camadas com
  // parallax invertido para profundidade.
  const offsetSlow = { x: parallax.x * 8, y: parallax.y * 8 }
  const offsetFast = { x: parallax.x * 20, y: parallax.y * 20 }

  return (
    <>
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          transform: `translate(${offsetSlow.x}px, ${offsetSlow.y}px)`,
          transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#C9A961" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          transform: `translate(${offsetFast.x}px, ${offsetFast.y}px)`,
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <pattern
              id="shapes"
              width="200"
              height="200"
              patternUnits="userSpaceOnUse"
            >
              <rect x="12" y="12" width="14" height="14" fill="#C9A961" opacity="0.6" />
              <line
                x1="60"
                y1="60"
                x2="120"
                y2="60"
                stroke="#C9A961"
                strokeWidth="1"
              />
              <rect
                x="150"
                y="120"
                width="6"
                height="40"
                fill="#C9A961"
                opacity="0.4"
              />
              <line
                x1="40"
                y1="160"
                x2="40"
                y2="190"
                stroke="#C9A961"
                strokeWidth="1"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#shapes)" />
        </svg>
      </div>

      {/* vinheta radial para o cartão central destacar */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(8, 22, 26, 0.7) 80%)',
        }}
      />
    </>
  )
}

function RaschMark({
  hover,
  success,
  parallax,
}: {
  hover: boolean
  success: boolean
  parallax: { x: number; y: number }
}) {
  // O R como porta — quando logas, o painel dourado rotaciona em Y para abrir.
  const rotateY = success ? -85 : hover ? -6 : 0
  const rotateX = success ? 0 : parallax.y * 4
  const rotateZ = parallax.x * 1.5

  return (
    <div
      className="relative mx-auto mb-2"
      style={{ perspective: '900px', width: 160, height: 160 }}
    >
      {/* Sombra/profundidade atrás do R */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(201,169,97,0.18) 0%, transparent 60%)',
          filter: 'blur(8px)',
          transform: success ? 'scale(1.5)' : 'scale(1)',
          transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Pequeno quadrado de acento — fica fora da rotação para criar contraste */}
      <div
        className="absolute"
        style={{
          left: 0,
          bottom: 0,
          width: 36,
          height: 36,
          background: '#5A7A7E',
          opacity: 0.92,
          transform: `translate(${parallax.x * -6}px, ${parallax.y * -6}px) ${
            success ? 'translateY(20px) rotate(-12deg)' : ''
          }`,
          transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        aria-hidden
      />

      {/* Painel dourado — o "R" que rotaciona */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`,
          transformOrigin: '20% 50%',
          transition: success
            ? 'transform 1.1s cubic-bezier(0.65, 0, 0.35, 1)'
            : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-label="Rasch Remodeling"
        >
          {/*
            R geométrica interpretada — duas formas que juntas formam um R
            estilizado, com o canto superior direito chanfrado (como uma folha
            dobrada). Inspirada no logo Rasch mas redesenhada para escalar
            limpamente em qualquer tamanho.
          */}
          <g fill="#C9A961">
            {/* corpo superior do R com canto chanfrado */}
            <path d="M 16 10 L 70 10 L 86 26 L 86 50 L 50 50 L 50 62 L 16 62 Z" />
            {/* perna diagonal */}
            <path d="M 50 50 L 64 50 L 92 92 L 78 92 Z" />
          </g>

          {/* destaque subtil — uma linha clara no painel para reforçar o "dobrar" */}
          <line
            x1="70"
            y1="10"
            x2="86"
            y2="26"
            stroke="#0E1F1D"
            strokeOpacity="0.18"
            strokeWidth="0.6"
          />
        </svg>
      </div>

      {/* "Interior" revelado quando o R abre — só aparece em success */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: success ? 1 : 0,
          transition: 'opacity 0.5s 0.5s ease-out',
        }}
        aria-hidden
      >
        <span className="font-display italic text-gold text-2xl">.</span>
      </div>
    </div>
  )
}

type FieldProps = {
  label: string
  type: 'email' | 'password'
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}

function Field({ label, type, value, onChange, autoComplete, required }: FieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <label className="block group">
      <span
        className={`text-[11px] tracking-editorial-wide uppercase block mb-2 transition-colors ${
          focused ? 'text-gold' : 'text-gold-dim'
        }`}
      >
        {label}
      </span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-bg-card/60 backdrop-blur-sm border border-line rounded-editorial px-4 py-3.5 text-cream-bright text-sm outline-none transition-all focus:border-gold focus:bg-bg-card focus:shadow-[0_0_0_3px_rgba(201,169,97,0.08)]"
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
