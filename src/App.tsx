import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Shell from '@/components/Shell'
import Login from '@/pages/Login'
import Painel from '@/pages/Painel'
import Clientes from '@/pages/Clientes'
import Orcamentos from '@/pages/Orcamentos'
import Obras from '@/pages/Obras'
import ObraDetail from '@/pages/ObraDetail'
import Despesas from '@/pages/Despesas'
import Decisoes from '@/pages/Decisoes'
import Familia from '@/pages/Familia'

function ProtectedLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-muted text-[11px] tracking-editorial-wide uppercase">
          A carregar…
        </span>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          element={session ? <ProtectedLayout /> : <Navigate to="/login" replace />}
        >
          <Route path="/" element={<Painel />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/obras/:id" element={<ObraDetail />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/decisoes" element={<Decisoes />} />
          <Route path="/familia" element={<Familia />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
