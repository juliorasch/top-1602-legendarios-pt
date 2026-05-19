import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import RaschMark from './RaschMark'

type Props = { children: ReactNode }

type NavItem = { to: string; label: string; end?: boolean }

const NAV_HUB: NavItem[] = [
  { to: '/', label: 'Hub', end: true },
  { to: '/painel', label: 'Empresa' },
  { to: '/familia', label: 'Família' },
]

const NAV_EMPRESA: NavItem[] = [
  { to: '/', label: 'Hub', end: true },
  { to: '/painel', label: 'Painel' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/obras', label: 'Obras' },
  { to: '/despesas', label: 'Despesas' },
  { to: '/decisoes', label: 'Decisões' },
  { to: '/relatorio', label: 'Relatório' },
]

const NAV_FAMILIA: NavItem[] = [
  { to: '/', label: 'Hub', end: true },
  { to: '/familia', label: 'Família' },
]

function pickNav(pathname: string): { items: NavItem[]; contexto: string | null } {
  if (pathname === '/') return { items: NAV_HUB, contexto: null }
  if (pathname.startsWith('/familia')) return { items: NAV_FAMILIA, contexto: 'Família' }
  return { items: NAV_EMPRESA, contexto: 'Empresa' }
}

export default function Shell({ children }: Props) {
  const { pathname } = useLocation()
  const { items, contexto } = pickNav(pathname)

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/92 backdrop-blur-md border-b border-line shadow-[0_2px_24px_rgba(8,22,26,0.5)]">
        <div className="max-w-6xl mx-auto px-6 pt-5 pb-2 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="group flex items-center gap-3 font-display text-xl text-cream-bright hover:text-gold transition-colors min-w-0"
          >
            <RaschMark
              size={28}
              showAccent={false}
              className="shrink-0 transition-transform group-hover:scale-110"
            />
            <span className="truncate">
              Daily <span className="italic text-gold">Rasch.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            {contexto && (
              <span className="hidden sm:inline-flex items-center gap-2 text-[10px] tracking-editorial-wide uppercase text-gold-dim">
                <span className="block h-px w-4 bg-gold-dim/60" />
                {contexto}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <ul className="flex gap-6 pb-3 min-w-max">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block text-[11px] tracking-editorial-wide uppercase pb-2 border-b-2 transition-colors ${
                      isActive
                        ? 'text-gold border-gold'
                        : 'text-muted border-transparent hover:text-cream'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>

      <BackToTop />
    </div>
  )
}

function BackToTop() {
  const [visible, setVisible] = useState(false)
  const [tchan, setTchan] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 320)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleClick() {
    setTchan(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => setTchan(false), 700)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Voltar ao topo"
      className={`fixed bottom-6 right-6 z-40 group transition-all duration-500 ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <span
        className={`absolute inset-0 rounded-full bg-gold/30 transition-transform duration-700 ease-out ${
          tchan ? 'scale-[2.4] opacity-0' : 'scale-100 opacity-0'
        }`}
        aria-hidden
      />
      <span
        className={`relative flex items-center justify-center w-12 h-12 rounded-full bg-bg-card border border-gold/60 text-gold shadow-[0_4px_16px_rgba(8,22,26,0.6)] group-hover:bg-gold group-hover:text-bg group-hover:border-gold transition-all ${
          tchan ? 'scale-110' : 'scale-100'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
          aria-hidden
        >
          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  )
}
