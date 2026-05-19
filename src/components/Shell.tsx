import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type Props = { children: ReactNode }

const nav = [
  { to: '/', label: 'Hub' },
  { to: '/painel', label: 'Painel' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/obras', label: 'Obras' },
  { to: '/despesas', label: 'Despesas' },
  { to: '/decisoes', label: 'Decisões' },
  { to: '/familia', label: 'Família' },
  { to: '/relatorio', label: 'Relatório' },
]

function RaschLogo() {
  return (
    <svg
      viewBox="0 0 820 260"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Rasch Remodeling"
      className="h-9 w-auto shrink-0 transition-transform group-hover:scale-105"
    >
      <g transform="translate(60, 40)">
        <rect x="0" y="138" width="44" height="44" fill="#5A7A7E" opacity="0.92" />
        <path
          d="M 36 16 L 120 16 L 176 52 L 92 112 L 180 184 L 152 184 L 92 124 L 36 124 Z"
          fill="#C9A961"
        />
      </g>
      <text
        x="280"
        y="158"
        fontFamily="'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="700"
        fontSize="118"
        fill="#E8E0D0"
        letterSpacing="-3"
      >
        Rasch
      </text>
      <text
        x="282"
        y="210"
        fontFamily="'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="400"
        fontSize="46"
        fill="#E8E0D0"
        letterSpacing="-1"
      >
        remodeling
      </text>
    </svg>
  )
}

export default function Shell({ children }: Props) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-2 flex items-center justify-between">
          <Link
            to="/"
            className="group flex items-center"
            aria-label="Rasch Remodeling — Daily Rasch"
          >
            <RaschLogo />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors"
          >
            Sair
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <ul className="flex gap-6 pb-3 min-w-max">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
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
    </div>
  )
}
