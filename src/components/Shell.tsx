import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import RaschMark from './RaschMark'

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
            className="group flex items-center gap-3 font-display text-xl text-cream-bright hover:text-gold transition-colors"
          >
            <RaschMark size={28} showAccent={false} className="shrink-0 transition-transform group-hover:scale-110" />
            Daily <span className="italic text-gold">Rasch.</span>
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
