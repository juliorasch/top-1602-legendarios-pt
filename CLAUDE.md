# Daily Rasch

> Plataforma de gestão integrada da Rasch Remodeling LDA — empresa e família, num só sítio, construída com IA.

Este documento é o briefing mestre do projeto. Qualquer Claude que trabalhe no Daily Rasch deve ler este ficheiro primeiro. Aqui está tudo: identidade da marca, arquitetura, decisões tomadas, princípios, próximos passos.

-----

## 1. SOBRE O PROJETO

**Nome:** Daily Rasch
**Dono:** Rasch Remodeling LDA (empresa de remodelação e construção em Portugal)
**Utilizadores:** O Rasch (fundador) e a sua esposa
**Domínio:** dailyrasch.com (a confirmar)
**Estado:** Em desenvolvimento — Fase 0

### O que é

Uma aplicação web privada (não pública) que organiza num único sítio:

- A operação da empresa (orçamentos, obras, clientes, decisões)
- As finanças da família (entradas, despesas fixas e variáveis, saldo)
- Integração com o iziBizi (faturação certificada AT)
- Captura inteligente de faturas (foto → IA lê → liga à obra)
- Relatórios automáticos semanais

### Para quê

Para que a Rasch Remodeling seja gerida com o mesmo padrão de excelência que aplica nas obras: organização, atenção ao detalhe, propósito, integridade. E para que a família tenha clareza financeira, com fé e disciplina.

-----

## 2. IDENTIDADE DA MARCA

A marca Rasch Remodeling LDA é definida por valores cristãos, integridade, excelência, atenção aos detalhes e profissionalismo. A plataforma Daily Rasch deve refletir isso em cada pixel.

### Princípios de marca

- **Profissional, mas humano** — autoridade sem arrogância
- **Direto, mas respeitoso** — clareza sem frieza
- **Confiante, mas sem soberba**
- **Sério, mas acolhedor**
- **Trabalho bem feito constrói reputação sólida** — frase fundadora

### Cores (paleta oficial, retirada da Proposta Comercial RAP-2026-012)

```css
--bg:           #0E1F1D;  /* verde-petróleo profundo — base */
--bg-2:         #142826;  /* variante mais clara */
--bg-card:      #1A302E;  /* fundo de cards */
--bg-deep:      #08161A;  /* fundo mais profundo (telemóvel) */
--gold:         #C9A961;  /* dourado champanhe — acento principal */
--gold-soft:    #D4B27F;  /* dourado suave */
--gold-dim:     #8C7848;  /* dourado contido */
--cream:        #E8E0D0;  /* creme — texto principal */
--cream-bright: #F5EDD8;  /* creme intenso — títulos */
--muted:        #8C9694;  /* texto secundário */
--line:         rgba(201, 169, 97, 0.18);  /* linhas subtis */
--line-strong:  rgba(201, 169, 97, 0.38);  /* linhas mais visíveis */
--positive:     #6BA77E;  /* verde — valores positivos */
--negative:     #D4715E;  /* terracota — alertas e valores negativos */
```

### Tipografia (Google Fonts)

- **Display / títulos:** Fraunces (variable, suporta itálico opsz)
- **Corpo / interface:** Manrope (300, 400, 500, 600, 700)

Convenção visual: usar **Fraunces normal** para o início do título e **Fraunces italic dourado** para o acento (ex: "Visão *geral.*", "Orçamentos *enviados.*").

### Linguagem visual editorial

- Numeração de secções: `01 —`, `02 —`, etc.
- Linhas douradas curtas a abrir blocos (28px de comprimento, 1px)
- Labels em uppercase com letter-spacing largo (`0.18em` a `0.25em`)
- Headers de tabela em fundo verde escuro com texto dourado
- Cantos com raio mínimo (2px) — estética de imprensa editorial

-----

## 3. ARQUITETURA TÉCNICA

### Stack escolhido

- **Frontend:** React + Tailwind CSS + Lucide icons + Fraunces/Manrope fonts
- **Backend:** Supabase (auth + base de dados PostgreSQL + storage para fotos de faturas)
- **Hospedagem:** Vercel
- **IA:** Anthropic API (Claude Sonnet para texto, Claude Vision para OCR de faturas)
- **Integração:** iziBizi via Cegid Cloudware API (OAuth 2.0)
- **Domínio:** dailyrasch.com (a comprar)
- **Repositório:** GitHub (privado)

### Princípios técnicos

- **Mobile-first** — o Rasch e a esposa usam principalmente telemóvel
- **Português europeu** em toda a interface
- **Multi-utilizador** com auth (Rasch + esposa)
- **Modular** — adicionar features deve ser barato no futuro
- **Privacidade** — dados financeiros, RGPD-compliant, encriptação em trânsito e repouso
- **Sem segredos no código** — todas as chaves em variáveis de ambiente

-----

## 4. ESTRUTURA DE DADOS (modelo inicial)

### Tabelas Supabase

**users** (auth.users — gerido pelo Supabase)

**clientes**

- id, nome, telefone, email, morada, nif, notas, created_at

**orcamentos**

- id, cliente_id, descricao, valor, data_envio, estado (enviado/em_analise/aceite/recusado), proximo_followup, pdf_url, created_at

**obras**

- id, cliente_id, orcamento_id, descricao, data_inicio, prazo, valor_contratado, estado (por_arrancar/em_curso/concluida), created_at

**despesas**

- id, obra_id (nullable), fornecedor, nif_fornecedor, valor, data, descricao, itens (JSON), foto_url, izibizi_id (nullable), categoria, confianca_ia, confirmado_pelo_user, created_at

**decisoes**

- id, titulo, descricao, prazo, prioridade (alta/media/baixa), estado (pendente/resolvida), obra_id (nullable), created_at

**entradas_familia**

- id, descricao, valor, categoria, data, recorrente, created_at

**despesas_familia**

- id, descricao, valor, categoria, tipo (fixa/variavel), data, recorrente, created_at

-----

## 5. FUNCIONALIDADES PRINCIPAIS (8 ecrãs aprovados)

Os ecrãs estão mockados e aprovados pelo Rasch. Manter coerência visual.

1. **Login** — Auth partilhado para Rasch + esposa
1. **Painel** — Visão geral empresa + família lado a lado
1. **Pipeline de Orçamentos** — Kanban com 4 estados
1. **Captura de Fatura** — Botão grande, câmara nativa do telemóvel
1. **IA lê a fatura** — Claude Vision extrai fornecedor, NIF, data, valor, itens
1. **Sugestão de Obra** — IA cruza itens com obras em curso e propõe a correta
1. **Vista de Obra** — Histórico completo, despesas linkadas, prazos
1. **Relatório Semanal** — Resumo automático segundas de manhã

-----

## 6. FASES DE DESENVOLVIMENTO

### Fase 0 — Preparação (em curso)

- [ ] Pedir credenciais API ao iziBizi
- [ ] Criar conta GitHub
- [ ] Criar conta Vercel
- [ ] Criar conta Supabase
- [ ] Criar conta Anthropic Console (API)
- [ ] Comprar domínio dailyrasch.com
- [ ] Decidir subscrição Claude Pro/Max

### Fase 1 — Fundações (semanas 1-2)

- [ ] Setup do projeto React
- [ ] Auth com Supabase
- [ ] Base de dados (tabelas e RLS)
- [ ] Primeira ligação à API iziBizi (testar pull de despesas)
- [ ] Deploy inicial no Vercel
- [ ] CI/CD básico

### Fase 2 — Core (semanas 3-4)

- [x] Painel principal (shell editorial com nav + dois cartões empresa/família)
- [x] CRUD de clientes (lista, criação, edição, eliminação)
- [x] CRUD de orçamentos (pipeline Kanban com 4 colunas)
- [x] CRUD de obras (Kanban 3 colunas, ligação a cliente + orçamento)
- [x] CRUD de decisões (lista priorizada com toggle pendentes/resolvidas)
- [x] Vista família (entradas + despesas, sumário do mês com saldo)
- [x] CRUD de despesas (lista filtrável por obra/estado, total acumulado)
- [x] Painel ligado a dados reais (KPIs empresa + saldo familiar do mês)

### Fase 3 — Inteligência (semanas 5-6)

- [x] Upload de foto/PDF de fatura (Supabase Storage bucket `faturas`, captura mobile)
- [x] Integração Claude Vision para OCR (edge function `analisar-fatura`, modelo `claude-opus-4-7` com `output_config.format` para JSON garantido)
- [x] Algoritmo de sugestão obra (edge function recebe obras em curso e devolve `obra_sugerida_id`)
- [x] Confirmação e correção manual (form pré-preenche campos da IA mas marca `confirmado_pelo_user = false` até user guardar)
- [ ] Sincronização bidirecional com iziBizi (a aguardar credenciais API)

> **Para activar a OCR:**
> 1. Aplicar `supabase/migrations/0002_storage_faturas.sql` no SQL Editor (cria bucket `faturas` + policies).
> 2. Definir o secret no projecto Supabase: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
> 3. Fazer deploy da edge function: `supabase functions deploy analisar-fatura`
>
> **Para activar o email semanal:**
> 1. Conta na Resend (https://resend.com) com domínio verificado para o `from`.
> 2. Secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` (lista separada por vírgulas), `CRON_SECRET` (token aleatório).
> 3. `supabase functions deploy email-relatorio-semanal`
> 4. Agendar via Supabase Cron (Dashboard → Database → Cron Jobs) — recomendado: segundas 09:00 Europe/Lisbon, com `Authorization: Bearer <CRON_SECRET>`.
>
> **Para activar a integração iziBizi (Fase 3, ainda em construção):**
> 1. Aplicar `supabase/migrations/0003_izibizi_session.sql` (cria a tabela de cache de tokens).
> 2. Secrets do projecto Supabase:
>    - `IZIBIZI_CLIENT_ID` — identificador OAuth obtido em iziBizi → Empresa → Configurações → Dados API
>    - `IZIBIZI_CLIENT_SECRET` — segredo correspondente
>    - `IZIBIZI_OAUTH_URL` — ex: `https://app3.business-pt.cegid.cloud/oauth`
>    - `IZIBIZI_API_URL` — ex: `https://api3.business-pt.cegid.cloud`
>    - (opcional) `IZIBIZI_FISCAL_YEAR_ID` — descobre-se via diag (passo 4 abaixo)
> 3. `supabase functions deploy izibizi-diag`
> 4. Testar OAuth + listar exercícios fiscais (sem `IZIBIZI_FISCAL_YEAR_ID`):
>    ```
>    curl -X POST <project-url>/functions/v1/izibizi-diag \
>      -H "Authorization: Bearer $CRON_SECRET" \
>      -d '{"step":"fiscal-years"}'
>    ```
> 5. Copiar o `id` do exercício fiscal desejado para o secret `IZIBIZI_FISCAL_YEAR_ID`.
> 6. Validar uma amostra real:
>    ```
>    curl -X POST <project-url>/functions/v1/izibizi-diag \
>      -H "Authorization: Bearer $CRON_SECRET" \
>      -d '{"step":"all"}'
>    ```
>    A response inclui a forma exacta dos JSON devolvidos por `commercial_purchases_documents` e `suppliers` — a partir daí construo as edge functions tipadas + UI.

### Fase 4 — Polimento (semanas 7-8)

- [x] Relatório semanal (dashboard `/relatorio` — secção "esta semana" + "próximos 7 dias")
- [x] Relatório semanal por email (edge function `email-relatorio-semanal`, renderiza HTML editorial e envia via Resend — falta agendar cron + secrets)
- [x] Notificações de follow-up de orçamentos (Painel — secção "Atenção")
- [x] Alertas de decisões pendentes (Painel — secção "Atenção", inclui obras com prazo)
- [x] Vista de Obra dedicada (`/obras/:id` — KPIs, despesas + decisões ligadas, margem)
- [ ] Manual de utilizador para Rasch e esposa
- [ ] Lançamento

-----

## 7. DECISÕES TOMADAS

| Data    | Decisão                                            | Razão                                                 |
| ------- | -------------------------------------------------- | ----------------------------------------------------- |
| 2026-05 | Versão completa à medida (não Notion + Make)       | Rasch quer plataforma sólida que cresce com a empresa |
| 2026-05 | Stack React/Supabase/Vercel                        | Combo moderno, manutenção barata, fácil de evoluir    |
| 2026-05 | Trabalho directo Claude ↔ Rasch                    | Rasch quer aprender o básico para manter              |
| 2026-05 | Identidade visual da Proposta RAP-2026-012         | Coerência total com a marca existente                 |
| 2026-05 | Mobile-first                                       | Uso principal é no telemóvel                          |
| 2026-05 | Português europeu                                  | Mercado é Portugal                                    |
| 2026-05 | Domínio dailyrasch.com (sujeito a disponibilidade) | Universal, limpo, evocativo                           |

-----

## 8. PRINCÍPIOS DE CÓDIGO

Construir como se construísse uma obra da Rasch — sólido, bem feito, sem atalhos.

- **Código limpo > código rápido** — preferir clareza a inteligência
- **Componentes pequenos e reutilizáveis** — para acrescentar features ser barato
- **Tipos fortes em TypeScript** — apanhar erros antes de runtime
- **Comentários só onde acrescentam valor** — código deve auto-explicar-se
- **Testes nas partes críticas** — integração iziBizi, cálculos financeiros, OCR
- **Acessibilidade desde o início** — não como afterthought
- **Performance importa** — mobile com 4G às vezes; otimizar imagens, code-split, lazy load
- **Commits frequentes, mensagens claras** — convenção: `feat:`, `fix:`, `chore:`, `docs:`

-----

## 9. CONTEXTO DO NEGÓCIO (Rasch Remodeling LDA)

### Serviços

- Reparações em telhados
- Impermeabilização
- Pavimentos em madeira, vinil, azulejo
- Remodelação integral

### Operação típica

- Orçamento detalhado, transparente (mão-de-obra separada de materiais)
- Materiais maioritariamente Leroy Merlin e IKEA Portugal
- Sem margem em material (transparência)
- Prazos típicos: 60 dias úteis para remodelação completa
- Pagamento típico: 100% na adjudicação (varia)

### Valores que devem refletir-se na plataforma

- **Integridade** — sem números escondidos, sem manipulação
- **Excelência** — acabamentos cuidados, atenção ao detalhe
- **Transparência** — para o Rasch ver tudo, para a esposa ver tudo
- **Fé e propósito** — gestão como ato de mordomia, não só como negócio
- **Trabalho bem feito honra a Deus, respeita o cliente, constrói reputação sólida**

-----

## 10. PRÓXIMOS PASSOS IMEDIATOS

1. **Rasch:** pedir credenciais API ao iziBizi (Empresa → Configurações → Dados API)
1. **Rasch + Claude:** subscrever Claude Pro (se ainda não tem)
1. **Rasch + Claude:** instalar Claude Code Desktop
1. **Claude:** iniciar setup do repositório no GitHub
1. **Claude:** scaffold do projeto React + Supabase
1. **Rasch:** comprar domínio dailyrasch.com (ou alternativa)

-----

## 11. COMO USAR ESTE FICHEIRO

Este `CLAUDE.md` é vivo. Atualizar sempre que:

- Uma decisão importante é tomada
- A arquitetura muda
- Uma fase termina
- Algo importante sobre o negócio muda

Manter o tom: directo, claro, respeitoso. Sem floreios. Como a Rasch trabalha.

-----

*Rasch Remodeling LDA — 2026*
*Trabalho bem feito constrói reputação sólida.*
