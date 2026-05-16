// Daily Rasch — izibizi-diag (versão self-contained para Dashboard Supabase)
//
// Esta é a versão inline (sem imports de _shared/) que se pode colar
// directamente no editor in-browser do Supabase. A versão modular
// "oficial" está em supabase/functions/izibizi-diag/index.ts + _shared/.

// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// ============================================================================
// CONFIG
// ============================================================================

const CLIENT_ID = Deno.env.get('IZIBIZI_CLIENT_ID')
const CLIENT_SECRET = Deno.env.get('IZIBIZI_CLIENT_SECRET')
const OAUTH_URL = Deno.env.get('IZIBIZI_OAUTH_URL') ?? 'https://app3.business-pt.cegid.cloud/oauth'
const API_URL = Deno.env.get('IZIBIZI_API_URL') ?? 'https://api3.business-pt.cegid.cloud'
const FISCAL_YEAR_ID = Deno.env.get('IZIBIZI_FISCAL_YEAR_ID') ?? null
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
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

// ============================================================================
// OAUTH HELPERS
// ============================================================================

function getServiceSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

function assertCredentials(): void {
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

async function getAccessToken(supabase: SupabaseClient): Promise<string> {
  const now = Date.now()
  const safetyMs = 60_000

  const { data: cached } = await supabase
    .from('izibizi_session')
    .select('*')
    .eq('id', 1)
    .maybeSingle<Session>()

  const isExpired = (iso: string | null) =>
    !iso || new Date(iso).getTime() <= now + safetyMs

  if (
    cached &&
    FISCAL_YEAR_ID &&
    cached.fiscal_year_token &&
    cached.fiscal_year_id === FISCAL_YEAR_ID &&
    !isExpired(cached.fiscal_year_expires_at)
  ) {
    return cached.fiscal_year_token
  }

  let baseToken: string | null = null
  let baseRefresh: string | null = null
  let baseExpiresAt: Date | null = null

  if (cached && !isExpired(cached.expires_at)) {
    baseToken = cached.access_token
    baseRefresh = cached.refresh_token
    baseExpiresAt = new Date(cached.expires_at)
  } else if (cached?.refresh_token) {
    const refreshed = await refreshAccessToken(cached.refresh_token)
    if (refreshed) {
      baseToken = refreshed.access_token
      baseRefresh = refreshed.refresh_token ?? cached.refresh_token
      baseExpiresAt = new Date(now + refreshed.expires_in * 1000)
    }
  }

  if (!baseToken) {
    const fresh = await fetchClientCredentialsToken()
    baseToken = fresh.access_token
    baseRefresh = fresh.refresh_token ?? null
    baseExpiresAt = new Date(now + fresh.expires_in * 1000)
  }

  let fyToken: string | null = null
  let fyExpiresAt: Date | null = null
  if (FISCAL_YEAR_ID) {
    const sw = await switchToFiscalYear(baseToken!, FISCAL_YEAR_ID)
    fyToken = sw.access_token
    fyExpiresAt = new Date(now + sw.access_ttl * 1000)
  }

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

async function izibiziFetch(
  path: string,
  init: RequestInit = {},
  supabase: SupabaseClient,
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
    await supabase.from('izibizi_session').delete().eq('id', 1)
    resp = await doFetch()
  }
  return resp
}

async function listFiscalYears(supabase: SupabaseClient): Promise<any[]> {
  const resp = await izibiziFetch('/api/fiscal_years_list', {}, supabase)
  if (!resp.ok) {
    throw new Error(`fiscal_years_list falhou (${resp.status}): ${await resp.text()}`)
  }
  const json = (await resp.json()) as { data: any[] }
  return json.data ?? []
}

// ============================================================================
// HANDLER
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sampleGet(path: string, supabase: SupabaseClient): Promise<unknown> {
  const resp = await izibiziFetch(path, {}, supabase)
  const text = await resp.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    // mantém texto cru
  }
  return { status: resp.status, body: parsed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método não permitido.' })
  }
  if (!CRON_SECRET) {
    return json(500, { error: 'CRON_SECRET em falta nos secrets do projecto.' })
  }
  const provided = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (provided !== CRON_SECRET) {
    return json(401, { error: 'Token inválido.' })
  }

  try {
    assertCredentials()
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) })
  }

  let step = 'all'
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.step === 'string') step = body.step
  } catch {
    // ignora
  }

  const supabase = getServiceSupabase()
  const result: Record<string, unknown> = {
    config: {
      oauth_url: OAUTH_URL,
      api_url: API_URL,
      has_fiscal_year_id: !!FISCAL_YEAR_ID,
    },
  }

  try {
    if (step === 'auth' || step === 'all') {
      const token = await getAccessToken(supabase)
      result.auth = {
        ok: true,
        token_length: token.length,
        token_prefix: token.slice(0, 8) + '…',
      }
    }
    if (step === 'fiscal-years' || step === 'all') {
      result.fiscal_years = await listFiscalYears(supabase)
    }
    if (step === 'despesas' || step === 'all') {
      result.despesas_sample = await sampleGet(
        '/api/commercial_purchases_documents?page[size]=5',
        supabase,
      )
    }
    if (step === 'fornecedores' || step === 'all') {
      result.fornecedores_sample = await sampleGet('/api/suppliers?page[size]=5', supabase)
    }

    return json(200, result)
  } catch (err) {
    return json(500, {
      ...result,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
