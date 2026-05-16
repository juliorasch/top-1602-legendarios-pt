// Daily Rasch — envia o relatório semanal por email
//
// Pensado para ser invocado por cron (pg_cron + pg_net no Supabase,
// ou serviço externo) à segunda-feira de manhã. Pode também ser
// invocado manualmente para testar.
//
// Deploy:
//   supabase functions deploy email-relatorio-semanal
//
// Secrets necessários no projecto Supabase:
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set EMAIL_FROM='Daily Rasch <relatorio@dailyrasch.com>'
//   supabase secrets set EMAIL_TO='rasch@example.com,esposa@example.com'
//   supabase secrets set CRON_SECRET=<random-token-para-proteger>
//
// Invocação (cron ou manual):
//   curl -X POST <function-url> \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Override do destinatário (testes):
//   curl -X POST <function-url> \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"to":["debug@example.com"]}'

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Daily Rasch <relatorio@dailyrasch.com>'
const EMAIL_TO = Deno.env.get('EMAIL_TO') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}
function addDays(d: Date, days: number): Date {
  const n = new Date(d)
  n.setDate(n.getDate() + days)
  return n
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const dataPt = new Intl.DateTimeFormat('pt-PT')
const diaMes = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long' })

const COR = {
  bg: '#0E1F1D',
  bg2: '#142826',
  card: '#1A302E',
  deep: '#08161A',
  gold: '#C9A961',
  goldDim: '#8C7848',
  cream: '#E8E0D0',
  creamBright: '#F5EDD8',
  muted: '#8C9694',
  line: 'rgba(201, 169, 97, 0.18)',
  positive: '#6BA77E',
  negative: '#D4715E',
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(data: {
  periodoInicio: Date
  periodoFim: Date
  proximaSemanaFim: Date
  orcamentosEnviados: any[]
  orcamentosAceites: any[]
  obrasIniciadas: any[]
  obrasConcluidas: any[]
  despesasSemana: any[]
  totalDespesas: number
  decisoesResolvidas: any[]
  followupsProximos: any[]
  obrasComPrazo: any[]
  decisoesComPrazo: any[]
  entradasFam: number
  despesasFam: number
}): string {
  const saldoFam = data.entradasFam - data.despesasFam
  const linha = `<tr><td style="height:1px;background:${COR.line};line-height:1px;font-size:1px">&nbsp;</td></tr>`

  function stat(label: string, value: string, accent: string, detalhe?: string) {
    return `
      <td valign="top" style="padding:16px;background:${COR.card};border:1px solid ${COR.line};border-radius:2px;">
        <div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.goldDim};margin-bottom:12px">${esc(label)}</div>
        <div style="font-family:Georgia,serif;font-size:22px;color:${accent};font-variant-numeric:tabular-nums">${esc(value)}</div>
        ${detalhe ? `<div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;color:${COR.muted};margin-top:6px">${esc(detalhe)}</div>` : ''}
      </td>
    `
  }

  function item(badge: string, badgeColor: string, titulo: string, detalhe: string) {
    return `
      <tr><td style="padding:12px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.card};border:1px solid ${COR.line};border-radius:2px">
          <tr>
            <td style="padding:14px 16px">
              <div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${badgeColor};margin-bottom:6px">${esc(badge)}</div>
              <div style="font-family:Georgia,serif;font-size:14px;color:${COR.creamBright};line-height:1.3">${esc(titulo)}</div>
              <div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;color:${COR.muted};margin-top:6px">${esc(detalhe)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    `
  }

  const proximos: string[] = []
  for (const o of data.followupsProximos) {
    const titulo = o.cliente?.nome ? `${o.cliente.nome} — ${o.descricao}` : o.descricao
    proximos.push(item('Follow-up', COR.gold, titulo, dataPt.format(new Date(o.proximo_followup))))
  }
  for (const o of data.obrasComPrazo) {
    proximos.push(item('Prazo obra', COR.goldDim, o.descricao, dataPt.format(new Date(o.prazo))))
  }
  for (const d of data.decisoesComPrazo) {
    proximos.push(
      item(
        d.prioridade === 'alta' ? 'Decisão · alta' : 'Decisão',
        d.prioridade === 'alta' ? COR.negative : COR.gold,
        d.titulo,
        dataPt.format(new Date(d.prazo)),
      ),
    )
  }

  return `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Daily Rasch — Sumário semanal</title>
</head>
<body style="margin:0;padding:0;background:${COR.bg};font-family:Manrope,Helvetica,Arial,sans-serif;color:${COR.cream}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.bg}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <tr><td>
          <div style="display:inline-block;height:1px;width:28px;background:${COR.gold};vertical-align:middle"></div>
          <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.gold};margin-left:12px">09 — Relatório</span>
        </td></tr>

        <tr><td style="padding-top:12px">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:36px;color:${COR.creamBright};line-height:1.1">
            Sumário <span style="color:${COR.gold};font-style:italic">semanal.</span>
          </h1>
        </td></tr>

        <tr><td style="padding-top:6px;padding-bottom:32px">
          <div style="font-style:italic;color:${COR.muted};font-size:13px">
            ${diaMes.format(data.periodoInicio)} — ${diaMes.format(data.periodoFim)}
          </div>
        </td></tr>

        <tr><td style="padding-bottom:8px">
          <div style="display:inline-block;height:1px;width:28px;background:${COR.gold};vertical-align:middle"></div>
          <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.gold};margin-left:12px">A semana — Empresa</span>
        </td></tr>
        ${linha}
        <tr><td style="padding:16px 0">
          <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
            <tr>
              ${stat('Orçamentos enviados', String(data.orcamentosEnviados.length), COR.creamBright, eur.format(data.orcamentosEnviados.reduce((a, o) => a + Number(o.valor), 0)))}
              ${stat('Orçamentos aceites', String(data.orcamentosAceites.length), data.orcamentosAceites.length > 0 ? COR.positive : COR.creamBright)}
            </tr>
            <tr>
              ${stat('Obras iniciadas', String(data.obrasIniciadas.length), COR.creamBright)}
              ${stat('Obras concluídas', String(data.obrasConcluidas.length), data.obrasConcluidas.length > 0 ? COR.positive : COR.creamBright)}
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:24px;padding-bottom:8px">
          <div style="display:inline-block;height:1px;width:28px;background:${COR.gold};vertical-align:middle"></div>
          <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.gold};margin-left:12px">A semana — Lançamentos</span>
        </td></tr>
        ${linha}
        <tr><td style="padding:16px 0">
          <table role="presentation" width="100%" cellpadding="6" cellspacing="0">
            <tr>
              ${stat('Despesas', String(data.despesasSemana.length), data.totalDespesas > 0 ? COR.negative : COR.creamBright, eur.format(data.totalDespesas))}
              ${stat('Decisões resolvidas', String(data.decisoesResolvidas.length), data.decisoesResolvidas.length > 0 ? COR.positive : COR.creamBright)}
            </tr>
            <tr>
              <td colspan="2" valign="top" style="padding:16px;background:${COR.card};border:1px solid ${COR.line};border-radius:2px;">
                <div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.goldDim};margin-bottom:12px">Saldo familiar da semana</div>
                <div style="font-family:Georgia,serif;font-size:26px;color:${saldoFam >= 0 ? COR.positive : COR.negative};font-variant-numeric:tabular-nums">${esc(eur.format(saldoFam))}</div>
                <div style="font-family:Manrope,Helvetica,Arial,sans-serif;font-size:11px;color:${COR.muted};margin-top:6px">Entradas ${esc(eur.format(data.entradasFam))} · Despesas ${esc(eur.format(data.despesasFam))}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:24px;padding-bottom:8px">
          <div style="display:inline-block;height:1px;width:28px;background:${COR.gold};vertical-align:middle"></div>
          <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COR.gold};margin-left:12px">Próximos 7 dias</span>
        </td></tr>
        ${linha}
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${proximos.length > 0
              ? proximos.join('')
              : `<tr><td style="padding:24px 0;text-align:center;color:${COR.muted};font-style:italic;font-size:13px">Sem prazos ou follow-ups marcados.</td></tr>`}
          </table>
        </td></tr>

        <tr><td style="padding-top:40px;padding-bottom:8px">
          <p style="margin:0;font-family:Georgia,serif;font-style:italic;color:${COR.muted};font-size:13px;text-align:center">
            Trabalho bem feito constrói reputação sólida.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Método não permitido.' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta.' })
  }
  if (!RESEND_API_KEY) {
    return json(500, { error: 'RESEND_API_KEY em falta. Definir nos secrets do projecto.' })
  }
  if (!CRON_SECRET) {
    return json(500, { error: 'CRON_SECRET em falta. Definir nos secrets do projecto.' })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (provided !== CRON_SECRET) {
    return json(401, { error: 'Token inválido.' })
  }

  let to: string[]
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body?.to) && body.to.length > 0) {
      to = body.to.map((x: unknown) => String(x))
    } else if (EMAIL_TO) {
      to = EMAIL_TO.split(',').map((x) => x.trim()).filter(Boolean)
    } else {
      return json(400, { error: 'Sem destinatários (definir EMAIL_TO ou passar { to } no body).' })
    }
  } catch {
    return json(400, { error: 'JSON inválido no body.' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const hoje = startOfDay(new Date())
  const inicio = addDays(hoje, -6)
  const proxima = addDays(hoje, 7)
  const inicioIso = iso(inicio)
  const hojeIso = iso(hoje)
  const proximaIso = iso(proxima)

  const [
    orcamentosEnviados,
    orcamentosAceites,
    obrasIniciadas,
    obrasConcluidas,
    despesasSemana,
    decisoesResolvidas,
    followupsProximos,
    obrasPrazoProximo,
    decisoesPrazoProximo,
    entradasFam,
    despesasFam,
  ] = await Promise.all([
    supabase
      .from('orcamentos')
      .select('id, descricao, valor, estado, data_envio, proximo_followup, cliente:clientes(nome)')
      .gte('data_envio', inicioIso)
      .lte('data_envio', hojeIso),
    supabase
      .from('orcamentos')
      .select('id, descricao, valor, estado, data_envio, proximo_followup, cliente:clientes(nome)')
      .eq('estado', 'aceite')
      .gte('created_at', inicio.toISOString()),
    supabase
      .from('obras')
      .select('id, descricao, prazo, data_inicio')
      .gte('data_inicio', inicioIso)
      .lte('data_inicio', hojeIso),
    supabase
      .from('obras')
      .select('id, descricao, prazo, data_inicio')
      .eq('estado', 'concluida')
      .gte('created_at', inicio.toISOString()),
    supabase
      .from('despesas')
      .select('id, fornecedor, valor, data')
      .gte('data', inicioIso)
      .lte('data', hojeIso),
    supabase
      .from('decisoes')
      .select('id, titulo, estado, prazo, prioridade')
      .eq('estado', 'resolvida')
      .gte('created_at', inicio.toISOString()),
    supabase
      .from('orcamentos')
      .select('id, descricao, proximo_followup, cliente:clientes(nome)')
      .in('estado', ['enviado', 'em_analise'])
      .not('proximo_followup', 'is', null)
      .gte('proximo_followup', hojeIso)
      .lte('proximo_followup', proximaIso)
      .order('proximo_followup', { ascending: true }),
    supabase
      .from('obras')
      .select('id, descricao, prazo')
      .eq('estado', 'em_curso')
      .not('prazo', 'is', null)
      .gte('prazo', hojeIso)
      .lte('prazo', proximaIso)
      .order('prazo', { ascending: true }),
    supabase
      .from('decisoes')
      .select('id, titulo, prazo, prioridade')
      .eq('estado', 'pendente')
      .not('prazo', 'is', null)
      .lte('prazo', proximaIso)
      .order('prazo', { ascending: true }),
    supabase
      .from('entradas_familia')
      .select('valor')
      .gte('data', inicioIso)
      .lte('data', hojeIso),
    supabase
      .from('despesas_familia')
      .select('valor')
      .gte('data', inicioIso)
      .lte('data', hojeIso),
  ])

  const errors = [
    orcamentosEnviados.error,
    orcamentosAceites.error,
    obrasIniciadas.error,
    obrasConcluidas.error,
    despesasSemana.error,
    decisoesResolvidas.error,
    followupsProximos.error,
    obrasPrazoProximo.error,
    decisoesPrazoProximo.error,
    entradasFam.error,
    despesasFam.error,
  ].filter(Boolean)
  if (errors.length > 0) {
    return json(500, { error: errors[0]!.message })
  }

  const totalDespesas = (despesasSemana.data ?? []).reduce((a, d) => a + Number(d.valor), 0)
  const entradasFamTotal = (entradasFam.data ?? []).reduce((a, d) => a + Number(d.valor), 0)
  const despesasFamTotal = (despesasFam.data ?? []).reduce((a, d) => a + Number(d.valor), 0)

  const html = renderHtml({
    periodoInicio: inicio,
    periodoFim: hoje,
    proximaSemanaFim: proxima,
    orcamentosEnviados: orcamentosEnviados.data ?? [],
    orcamentosAceites: orcamentosAceites.data ?? [],
    obrasIniciadas: obrasIniciadas.data ?? [],
    obrasConcluidas: obrasConcluidas.data ?? [],
    despesasSemana: despesasSemana.data ?? [],
    totalDespesas,
    decisoesResolvidas: decisoesResolvidas.data ?? [],
    followupsProximos: followupsProximos.data ?? [],
    obrasComPrazo: obrasPrazoProximo.data ?? [],
    decisoesComPrazo: decisoesPrazoProximo.data ?? [],
    entradasFam: entradasFamTotal,
    despesasFam: despesasFamTotal,
  })

  const subject = `Daily Rasch — Sumário ${diaMes.format(inicio)} a ${diaMes.format(hoje)}`

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return json(502, { error: `Resend falhou (${resp.status}): ${text}` })
  }

  const data = await resp.json().catch(() => ({}))
  return json(200, { sent: to.length, id: (data as any)?.id ?? null })
})
