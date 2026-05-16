// Daily Rasch — analisar-fatura (versão self-contained com fetch directo)
//
// Esta versão NÃO usa o SDK Anthropic — chama a API REST directamente.
// Mais fiável (sem problemas de versão de SDK) e com logs detalhados
// para diagnosticar problemas.
//
// Para colar no Dashboard Supabase → Functions → analisar-fatura → Code.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractJSON(text: string): unknown {
  // Claude às vezes envolve JSON em ```json ... ``` ou adiciona texto
  // antes/depois. Esta função extrai o JSON robustamente.
  const trimmed = text.trim()

  // Caso 1: vem limpo
  try {
    return JSON.parse(trimmed)
  } catch {
    // continua
  }

  // Caso 2: envolto em ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) {
    try {
      return JSON.parse(fenced[1])
    } catch {
      // continua
    }
  }

  // Caso 3: procura o primeiro { e o último }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      // continua
    }
  }

  throw new Error(`Resposta da IA não contém JSON válido. Resposta: ${trimmed.slice(0, 500)}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método não permitido.' })
  }

  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      error: 'Configuração em falta. Verifica ANTHROPIC_API_KEY nos secrets.',
      missing: {
        ANTHROPIC_API_KEY: !ANTHROPIC_API_KEY,
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SUPABASE_SERVICE_ROLE_KEY,
      },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'Sem autorização (Authorization header em falta).' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return json(401, {
      error: 'Não autenticado.',
      detail: userError?.message ?? 'Sem user no token.',
    })
  }

  let payload: { fotoPath?: string }
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'JSON inválido no corpo.' })
  }

  const fotoPath = payload.fotoPath?.trim()
  if (!fotoPath) {
    return json(400, { error: 'fotoPath em falta no body.' })
  }

  console.log(`[analisar-fatura] Download foto: ${fotoPath}`)

  const { data: blob, error: dlError } = await supabase.storage
    .from('faturas')
    .download(fotoPath)
  if (dlError || !blob) {
    return json(404, {
      error: `Não foi possível descarregar a foto.`,
      detail: dlError?.message ?? 'blob undefined',
      fotoPath,
    })
  }

  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  const base64 = btoa(binary)
  const mediaType = blob.type || 'image/jpeg'

  console.log(`[analisar-fatura] Foto convertida — type: ${mediaType}, size: ${buf.length} bytes`)

  // Validar tipo de imagem suportado pela Anthropic
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(mediaType)) {
    return json(400, {
      error: `Tipo de imagem não suportado pela IA: ${mediaType}. Usa JPG, PNG, GIF ou WebP.`,
    })
  }

  const { data: obras } = await supabase
    .from('obras')
    .select('id, descricao, cliente:clientes(nome)')
    .eq('estado', 'em_curso')

  const obrasContext = obras && obras.length > 0
    ? obras
        .map((o: any) => {
          const cli = o.cliente?.nome ? `${o.cliente.nome} — ` : ''
          return `- ${o.id}: ${cli}${o.descricao}`
        })
        .join('\n')
    : '(Sem obras em curso registadas.)'

  const prompt =
    'Analisa esta fatura/recibo portuguesa e devolve APENAS um JSON válido (sem markdown, sem texto antes ou depois) com este formato exacto:\n\n' +
    '{\n' +
    '  "fornecedor": "nome comercial (ex: Leroy Merlin, Continente)",\n' +
    '  "nif_fornecedor": "9 dígitos se visível, senão null",\n' +
    '  "data": "YYYY-MM-DD",\n' +
    '  "valor": número decimal do total a pagar em euros (não string),\n' +
    '  "categoria": "uma palavra: Material, Ferramenta, Serviço, Transporte, Combustível, Alimentação, ou outra",\n' +
    '  "itens": [{"descricao": "...", "valor": número}],\n' +
    '  "obra_sugerida_id": "UUID da obra mais provável da lista abaixo, ou null se nenhuma fizer sentido",\n' +
    '  "confianca": número entre 0 e 1\n' +
    '}\n\n' +
    'Obras em curso disponíveis:\n' +
    obrasContext +
    '\n\nIMPORTANTE: devolve APENAS o JSON, sem ```json, sem prefácio.'

  console.log('[analisar-fatura] A chamar Anthropic API…')

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[analisar-fatura] Fetch falhou: ${msg}`)
    return json(502, { error: `Falha de rede a chamar Anthropic: ${msg}` })
  }

  console.log(`[analisar-fatura] Anthropic respondeu status ${response.status}`)

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[analisar-fatura] Anthropic erro ${response.status}: ${errText}`)
    return json(502, {
      error: `Anthropic API devolveu ${response.status}`,
      detail: errText.slice(0, 1000),
    })
  }

  const anthropicData = await response.json()
  const textBlock = anthropicData.content?.find((b: any) => b.type === 'text')
  const text: string = textBlock?.text ?? ''

  if (!text) {
    console.error('[analisar-fatura] Anthropic devolveu resposta sem texto')
    return json(502, {
      error: 'IA devolveu resposta vazia.',
      raw: anthropicData,
    })
  }

  console.log(`[analisar-fatura] Resposta IA (${text.length} chars): ${text.slice(0, 200)}…`)

  let result: Record<string, unknown>
  try {
    result = extractJSON(text) as Record<string, unknown>
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[analisar-fatura] Parse JSON falhou: ${msg}`)
    return json(502, { error: msg })
  }

  console.log('[analisar-fatura] OK — devolvendo resultado.')
  return json(200, result)
})
