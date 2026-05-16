// Daily Rasch — cliente partilhado para a API do iziBizi (Cegid Cloudware)
//
// Trata do fluxo OAuth 2.0 client_credentials, da rotação de token e do
// "sub-switch" para um exercício fiscal específico. Cacheia tokens na
// tabela public.izibizi_session para evitar reautenticar a cada chamada.
//
// Secrets necessários no projecto Supabase:
//   IZIBIZI_CLIENT_ID
//   IZIBIZI_CLIENT_SECRET
//   IZIBIZI_OAUTH_URL          (ex: https://app3.business-pt.cegid.cloud/oauth)
//   IZIBIZI_API_URL            (ex: https://api3.business-pt.cegid.cloud)
//   IZIBIZI_FISCAL_YEAR_ID     (opcional — se não definido, usa o token base
//                               sem switch de exercício; correr `izibizi-diag`
//                               primeiro para obter o id correcto)

// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export type FiscalYear = {
  id: string
  attributes?: Record<string, any>
  [k: string]: any
}

const CLIENT_ID = Deno.env.get('IZIBIZI_CLIENT_ID')
const CLIENT_SECRET = Deno.env.get('IZIBIZI_CLIENT_SECRET')
const OAUTH_URL = Deno.env.get('IZIBIZI_OAUTH_URL') ?? 'https://app3.business-pt.cegid.cloud/oauth'
const API_URL = Deno.env.get('IZIBIZI_API_URL') ?? 'https://api3.business-pt.cegid.cloud'
const FISCAL_YEAR_ID = Deno.env.get('IZIBIZI_FISCAL_YEAR_ID') ?? null

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export function getServiceSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export function assertCredentials(): void {
  const missing: string[] = []
  if (!CLIENT_ID) missing.push('IZIBIZI_CLIENT_ID')
  if (!CLIENT_SECRET) missing.push('IZIBIZI_CLIENT_SECRET')
  if (missing.length > 0) {
    throw new Error(`Secrets em falta: ${missing.join(', ')}`)
  }
}

function basicAuthHeader(): string {
  return 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
}

async function fetchClientCredentialsToken(): Promise<TokenResponse> {
  assertCredentials()
  const resp = await fetch(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body: 'grant_type=client_credentials&scope=commercial',
  })
  if (!resp.ok) {
    throw new Error(`OAuth /token falhou (${resp.status}): ${await resp.text()}`)
  }
  return (await resp.json()) as TokenResponse
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  const resp = await fetch(`${OAUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body: `grant_type=refresh_token&scope=commercial&refresh_token=${encodeURIComponent(refreshToken)}`,
  })
  if (!resp.ok) return null
  return (await resp.json()) as TokenResponse
}

async function switchToFiscalYear(
  accessToken: string,
  fiscalYearId: string,
): Promise<{ access_token: string; access_ttl: number }> {
  const resp = await fetch(`${API_URL}/api/entity_sub_switch`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'sub-switch',
      to_subtype: 'fiscal-year',
      to_subentity_id: fiscalYearId,
    }),
  })
  if (!resp.ok) {
    throw new Error(`entity_sub_switch falhou (${resp.status}): ${await resp.text()}`)
  }
  const data = (await resp.json()) as { access_token: string; access_ttl: string | number }
  return { access_token: data.access_token, access_ttl: Number(data.access_ttl) }
}

type Session = {
  id: number
  access_token: string
  refresh_token: string | null
  fiscal_year_token: string | null
  fiscal_year_id: string | null
  expires_at: string
  fiscal_year_expires_at: string | null
}

/**
 * Devolve um access_token válido (refrescando ou pedindo novo se necessário)
 * e, se IZIBIZI_FISCAL_YEAR_ID estiver definido, executa o sub-switch para o
 * exercício fiscal escolhido devolvendo o token resultante.
 *
 * Cacheia tudo na tabela public.izibizi_session.
 */
export async function getAccessToken(
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<string> {
  const now = Date.now()
  const safetyMs = 60_000 // refrescar 60s antes do fim para evitar 401 em voo

  const { data: cached } = await supabase
    .from('izibizi_session')
    .select('*')
    .eq('id', 1)
    .maybeSingle<Session>()

  const isExpired = (iso: string | null) =>
    !iso || new Date(iso).getTime() <= now + safetyMs

  // 1. Já temos um fiscal_year_token válido E foi feito switch para o
  //    exercício correcto → usar.
  if (
    cached &&
    FISCAL_YEAR_ID &&
    cached.fiscal_year_token &&
    cached.fiscal_year_id === FISCAL_YEAR_ID &&
    !isExpired(cached.fiscal_year_expires_at)
  ) {
    return cached.fiscal_year_token
  }

  // 2. Já temos access_token base válido — usar ou switchar se preciso.
  let baseToken: string | null = null
  let baseRefresh: string | null = null
  let baseExpiresAt: Date | null = null

  if (cached && !isExpired(cached.expires_at)) {
    baseToken = cached.access_token
    baseRefresh = cached.refresh_token
    baseExpiresAt = new Date(cached.expires_at)
  } else if (cached?.refresh_token) {
    // 3. Tentar refresh.
    const refreshed = await refreshAccessToken(cached.refresh_token)
    if (refreshed) {
      baseToken = refreshed.access_token
      baseRefresh = refreshed.refresh_token ?? cached.refresh_token
      baseExpiresAt = new Date(now + refreshed.expires_in * 1000)
    }
  }

  // 4. Sem token utilizável → pedir um novo via client_credentials.
  if (!baseToken) {
    const fresh = await fetchClientCredentialsToken()
    baseToken = fresh.access_token
    baseRefresh = fresh.refresh_token ?? null
    baseExpiresAt = new Date(now + fresh.expires_in * 1000)
  }

  // 5. Switch para o exercício fiscal se configurado.
  let fyToken: string | null = null
  let fyExpiresAt: Date | null = null
  if (FISCAL_YEAR_ID) {
    const sw = await switchToFiscalYear(baseToken!, FISCAL_YEAR_ID)
    fyToken = sw.access_token
    fyExpiresAt = new Date(now + sw.access_ttl * 1000)
  }

  // 6. Persistir.
  await supabase.from('izibizi_session').upsert({
    id: 1,
    access_token: baseToken!,
    refresh_token: baseRefresh,
    fiscal_year_token: fyToken,
    fiscal_year_id: FISCAL_YEAR_ID,
    expires_at: baseExpiresAt!.toISOString(),
    fiscal_year_expires_at: fyExpiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  })

  return fyToken ?? baseToken!
}

/**
 * Fetch autenticado contra a API do iziBizi. Adiciona headers obrigatórios
 * (Content-Type application/vnd.api+json em POST/PATCH, Accept, Authorization)
 * e prefixa o path com API_URL.
 *
 * Em 401, faz uma retry depois de forçar a renovação do token.
 */
export async function izibiziFetch(
  path: string,
  init: RequestInit = {},
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const token = await getAccessToken(supabase)
    const headers = new Headers(init.headers ?? {})
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/vnd.api+json')
    }
    const url = path.startsWith('http')
      ? path
      : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
    return await fetch(url, { ...init, headers })
  }

  let resp = await doFetch()
  if (resp.status === 401) {
    // Invalida cache e tenta novamente.
    await supabase.from('izibizi_session').delete().eq('id', 1)
    resp = await doFetch()
  }
  return resp
}

/**
 * Lista de exercícios fiscais disponíveis para esta conta.
 * Útil para o setup inicial — corre uma vez para obter o id que vai
 * para o secret IZIBIZI_FISCAL_YEAR_ID.
 */
export async function listFiscalYears(
  supabase: SupabaseClient = getServiceSupabase(),
): Promise<FiscalYear[]> {
  const resp = await izibiziFetch('/api/fiscal_years_list', {}, supabase)
  if (!resp.ok) {
    throw new Error(`fiscal_years_list falhou (${resp.status}): ${await resp.text()}`)
  }
  const json = (await resp.json()) as { data: FiscalYear[] }
  return json.data ?? []
}

export { API_URL, OAUTH_URL }
