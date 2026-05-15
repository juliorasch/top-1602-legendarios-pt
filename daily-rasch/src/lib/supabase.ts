import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltam variáveis de ambiente Supabase: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copia .env.example para .env.local.',
  )
}

export const supabase = createClient(url, anonKey)
