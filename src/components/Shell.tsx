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

export default function Shell({ children }: Props) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-bg">
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        header { position: sticky; top: 0; z-index: 50; background: linear-gradient(180deg, rgba(14, 31, 29, 0.98) 0%, rgba(14, 31, 29, 0.92) 100%); backdrop-filter: blur(10px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); }
        .logo-container { animation: float 3.5s ease-in-out infinite; transition: transform 0.3s ease; }
        .logo-container:hover { transform: scale(1.08) translateY(-4px); filter: drop-shadow(0 8px 12px rgba(201, 169, 97, 0.3)); }
        .logout-btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
        .logout-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: rgba(201, 169, 97, 0.1); transition: left 0.5s ease; }
        .logout-btn:hover::before { left: 100%; }
        .logout-btn:hover { color: #C9A961; transform: translateX(3px); }
        .nav-item { position: relative; transition: all 0.3s ease; }
        .nav-item::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0%; height: 2px; background: linear-gradient(90deg, #C9A961, #E8B956); transition: width 0.3s ease; }
        .nav-item:hover::after, .nav-item.active::after { width: 100%; }
      `}</style>
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-2 flex items-center justify-between">
          <Link to="/" className="logo-container group flex items-center" aria-label="Rasch Remodeling">
            <img src="/rasch-logo.png" alt="Rasch Remodeling" className="h-10 w-auto" loading="eager" />
          </Link>
          <button type="button" onClick={handleLogout} className="logout-btn text-muted text-[11px] tracking-editorial-wide uppercase hover:text-gold transition-colors">
            Sair
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <ul className="flex gap-6 pb-3 min-w-max">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item block text-[11px] tracking-editorial-wide uppercase pb-2 border-b-2 transition-all ${isActive ? 'text-gold border-gold' : 'text-muted border-transparent hover:text-cream'}`}>
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
