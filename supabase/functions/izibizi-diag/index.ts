// Daily Rasch — diagnóstico inicial da integração iziBizi
//
// Edge function usada uma única vez no setup, antes de construirmos a
// UI tipada. Verifica que:
//   1. A autenticação OAuth funciona (token client_credentials)
//   2. Lista os exercícios fiscais (para escolher o IZIBIZI_FISCAL_YEAR_ID)
//   3. Faz amostra de pedidos GET aos recursos que vamos usar, devolvendo
//      a response RAW para inferirmos a forma exacta dos dados.
//
// Protegida pelo CRON_SECRET (mesmo padrão das outras edge functions
// administrativas) para evitar abuso.
//
// Uso:
//   curl -X POST <function-url>/izibizi-diag \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"step": "fiscal-years"}'
//
// Steps disponíveis:
//   - "auth"          → só pede token e devolve metadata (sem revelar token)
//   - "fiscal-years"  → lista exercícios fiscais
//   - "despesas"      → GET /api/commercial_purchases_documents?page[size]=5
//   - "fornecedores"  → GET /api/suppliers?page[size]=5
//   - "all"           → executa todos os passos acima em sequência

// deno-lint-ignore-file no-explicit-any
import {
  assertCredentials,
  getAccessToken,
  getServiceSupabase,
  izibiziFetch,
  listFiscalYears,
  OAUTH_URL,
  API_URL,
} from '../_shared/izibizi.ts'

const CRON_SECRET = Deno.env.get('CRON_SECRET')

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

async function sampleGet(path: string): Promise<unknown> {
  const resp = await izibiziFetch(path)
  const text = await resp.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    // não é JSON, mantém texto cru
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
      has_fiscal_year_id: !!Deno.env.get('IZIBIZI_FISCAL_YEAR_ID'),
    },
  }

  try {
    if (step === 'auth' || step === 'all') {
      // Forçar carregamento do token (mas não revelá-lo)
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
      )
    }

    if (step === 'fornecedores' || step === 'all') {
      result.fornecedores_sample = await sampleGet('/api/suppliers?page[size]=5')
    }

    return json(200, result)
  } catch (err) {
    return json(500, {
      ...result,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
