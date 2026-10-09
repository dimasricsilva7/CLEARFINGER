# CLEARFINGER

Loja de página única da marca **CLEARFINGER** (removedor de manchas de nicotina para mãos e unhas): landing page de conversão, checkout com **PIX (BravoPay)** e **Crediário (protocolo)**, painel administrativo com CMS, tracking próprio, Meta Pixel/CAPI e Google.

O projeto reaproveita a base já em produção dos projetos **HAMA BEADS** (pedidos, PIX, webhook, tracking, admin, CMS, auth) e **MONTEZ** (imagens guardadas no próprio banco). O mapeamento completo está em [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| Estilo | Tailwind CSS 3 com tokens de cor em CSS vars (editáveis no admin) |
| Banco | PostgreSQL (Neon) + Prisma 6 |
| Pagamento | BravoPay (PIX) · Crediário próprio (sem gateway) |
| Imagens | sharp → WebP guardado no Postgres, servido por `/media/[id].webp` com cache imutável de CDN |
| Deploy | Vercel (região `iad1`), domínio `clearfingerbr.shop` com HTTPS (Let's Encrypt automático + HSTS), cron diário + GitHub Actions a cada 5 min |

## Estrutura

```
prisma/                schema, migrations e seed (conteúdo inicial)
public/brand/          imagens da marca (logo, kit) — trocáveis pelo admin
src/app/(site)/(store) landing page e políticas
src/app/(site)/(checkout) checkout e página do pedido (PIX / crediário)
src/app/admin/         painel (dashboard, pedidos, CMS, pagamentos, tracking…)
src/app/api/           checkout, webhook BravoPay, tracking, status do pedido, jobs, upload
src/lib/               domínio, crediário, pagamentos, auth, tracking, crypto, logs
src/server/            pedidos, catálogo, landing, configurações, relatórios, jobs, mídia
scripts/               e2e, screenshots, preparo das imagens da marca, hash de senha
tests/                 testes unitários (node:test)
```

## Ambiente local

```bash
npm install
cp .env.example .env            # preencha DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY…
npx prisma migrate deploy
npm run db:seed                 # landing, FAQ, produto e kits iniciais
npm run admin:hash -- "uma-senha-forte-12+"   # cole em ADMIN_PASSWORD_HASH (+ ADMIN_EMAIL)
npm run dev                     # http://localhost:3000 · admin em /admin
```

Para testar o fluxo sem cobrança real use `BRAVOPAY_MODE=mock` (gera PIX fictício; o admin ganha o botão **Simular pagamento**, que envia um webhook assinado pelo mesmo caminho de produção). O modo mock é bloqueado em produção.

### Testes

```bash
npm run typecheck && npm run lint && npm test         # tipos, lint, unitários
npx tsx scripts/e2e-funnel.ts http://localhost:3000   # ponta a ponta: PIX + webhook + crediário + admin (mock!)
npx tsx scripts/e2e-images.ts http://localhost:3000   # envio de imagens por arquivo e por URL
npx tsx scripts/screenshots.ts http://localhost:3000 / screenshots   # 375 / 390 / 1440 px
npx tsx scripts/review-mobile.ts http://localhost:3000 screenshots     # 375 / 390 / 414 px sem rolagem horizontal
```

> Nunca rode os testes E2E contra produção com a BravoPay real — eles criam pedidos.

## Variáveis de ambiente

Veja [.env.example](.env.example). Obrigatórias em produção: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEXT_PUBLIC_SITE_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `BRAVOPAY_API_KEY`, `BRAVOPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (primeiro acesso). O admin mostra em **Configurações → Sistema** quais estão presentes (nunca os valores).

## Pagamentos

### PIX (BravoPay)
- `src/lib/payments/bravopay.ts` é o único arquivo que fala com a BravoPay (`POST /transactions`, `GET /transactions?external_reference=`), com `Idempotency-Key`.
- O pedido é criado de forma idempotente (`checkoutToken`) e o PIX é gerado no servidor; o navegador recebe só o copia e cola e o QR (gerado localmente).
- **Pago só por confirmação do gateway**: webhook, consulta ("Já paguei") ou reconciliação (`/api/tick`, `/api/cron/all`). `applyPaymentSnapshot` em `src/server/orders.ts` é o ponto único de mudança de status; valor pago menor que o total não confirma.
- PIX expirado pode ser renovado no mesmo pedido (nova `external_reference`).

### Webhook `/api/webhooks/bravopay`
Lê o corpo bruto → valida `BravoPay-Signature` (`t=…,v1=…`, HMAC-SHA256, tolerância 5 min) → registra em `WebhookEvent` com `eventId` único (duplicatas respondem 200 sem reprocessar) → localiza o pedido por `external_reference`/`transactionId` → aplica o status → grava status anterior/novo, transação e horário. Falhas respondem 500 (a BravoPay reenvia) e o job reprocessa. O payload é salvo sem dados pessoais.
Cadastre no painel BravoPay: `https://SEU-DOMINIO/api/webhooks/bravopay` e copie o segredo do endpoint para `BRAVOPAY_WEBHOOK_SECRET`.

### Crediário (protocolo — não é cartão)
- O cliente informa **protocolo** (16 dígitos por padrão), **validade** (formato configurável), **últimos dígitos do CPF** (3 por padrão) e **parcelas** (até 2x por padrão).
- Validação idêntica no navegador e no servidor (`src/lib/crediario.ts`), sempre com a configuração atual.
- O pedido nasce `CREDIARIO_PENDENTE`; o admin muda para em análise / aprovado / recusado / cancelado / concluído na página do pedido. **Aprovado conta como venda** (estoque, evento `purchase`, Meta Purchase via CAPI).
- Protocolo, validade e dígitos do CPF ficam **cifrados (AES-256-GCM)** no banco; o admin vê o CPF como `***123` e o protocolo mascarado, com botão "ver completo" (registrado na auditoria). Esses dados nunca vão para URL, logs, eventos de tracking, Meta ou Google.
- **Todos os textos e regras** (nome do método, títulos, placeholders, dígitos, formato da validade, máximo de parcelas, texto das parcelas, mensagens, botão, texto de segurança) ficam em **Admin → Pagamentos → Crediário**, com prévia ao vivo. Mudanças valem na hora, sem deploy.

## Entrega, frete e rastreio

- **Frete**: Admin → Configurações → **Entrega** — liga/desliga frete grátis, texto do frete, prazo ("3 a 5 dias úteis"), texto do prazo e do checkout. Aparece no hero, nos kits, no CTA final, no resumo do checkout e na página do pedido.
- **Linha do tempo automática** (`src/lib/delivery.ts`, testada em `tests/delivery.test.ts`): a partir do pagamento confirmado (PIX pago ou crediário aprovado), fuso America/Sao_Paulo, só dias úteis (fins de semana e feriados configurados são pulados):
  1. Pagamento concluído — na hora · 2. Separando pedido — próximo dia útil 10:30 · 3. Chegou ao centro de distribuição — mesmo dia 16:30 · 4. Despachado para a cidade de destino — dia útil seguinte 09:30 · 5. Chegou ao CD da cidade destino — mesmo dia 16:30 · 6. Saiu para entrega — dia útil seguinte 10:30 · **Entregue — só manual**.
- **Agendador global**: nenhum cron por pedido. As etapas vencidas são gravadas em `OrderTrackingEvent` pelo job (`/api/cron/all`, `/api/tick`) e também na hora em que o cliente ou o admin abre o pedido. `Order.fulfillmentStatus` acompanha (Em preparação → Enviado → Entregue).
- **Admin → Pedido → Rastreio da entrega**: mostra cada evento como automático/manual, permite lançar atualização manual (etapa, data/hora, título, descrição, observação interna), **Marcar como entregue** e ocultar um evento para corrigir — nada é apagado. Títulos/descrições de cada etapa, feriados e a automação ficam em Configurações → Entrega.
- **/rastrear-pedido** (link no cabeçalho e no rodapé): número do pedido + CPF **ou** e-mail. Rate limit em memória e persistente (por IP e por pedido), mesma resposta genérica para pedido inexistente e dado errado, atraso uniforme, nenhum dado pessoal na resposta. Eventos: `tracking_page_view, tracking_search_started, tracking_order_found, tracking_order_not_found, tracking_status_viewed` — só no tracking próprio, sem número do pedido, CPF ou e-mail.

## Ofertas (Order bump e Upsell)

- **Admin → Ofertas → Order bump**: "Adicione também ao seu pedido" no checkout (título/texto em Configurações → Checkout). Cada bump aponta para um produto (ex.: frasco extra, CLEARFINGER HAND CARE, CLEARFINGER ODOR CONTROL), com preço, texto, imagem, ordem e status.
- **Admin → Ofertas → Upsell**: oferta na página do pedido depois da compra (PIX pago e/ou pedido no crediário), com produto, título, descrição, preço, imagem, textos dos botões, posição e ordem. **Aceitar** cria um novo pedido PIX vinculado (`Order.parentOrderId`, `source = UPSELL`); **recusar** só esconde. O pedido original nunca é alterado. Métricas de exibição/aceite/recusa na própria página.
- Produtos complementares (`prisma/update-2026-10-08b.ts`): **CLEARFINGER HAND CARE** e **CLEARFINGER ODOR CONTROL** foram criados **inativos, sem imagem e com preço provisório** — assim como os bumps/upsell deles. Cadastre a foto real e o preço em Produtos e ative.

## E-mails

Resend (API REST) — `RESEND_API_KEY` + `EMAIL_FROM` (domínio verificado). Templates no visual da marca em `src/emails/templates.ts` (tabelas + estilos inline; logo e foto em PNG/JPG em `public/email/`, gerados por `scripts/email-assets.ts`).

| E-mail | Quando | Cancelado se |
|---|---|---|
| Confirmação de compra | PIX pago ou crediário aprovado (na hora) | — |
| PIX pendente | 10 min após gerar o PIX (configurável) | o pedido for pago |
| Checkout abandonado | 30 min após a última digitação no checkout (configurável) | virar pedido / descadastro / 72 h |

- Cada envio fica em `EmailEvent` (agendado, enviado, falhou, cancelado) e aparece no pedido; reenvio manual na lista e na página do pedido (anti-spam de 2 min).
- Checkout abandonado: `CheckoutLead` guarda nome, e-mail, WhatsApp e o kit (nunca CPF, endereço ou crediário). O link `/checkout?recuperar=…` restaura tudo. Admin → Checkouts abandonados (reenviar e-mail, WhatsApp).
- Lembretes têm descadastro one-click (`List-Unsubscribe`). Textos, tempos, prévia e e-mail de teste em Configurações → E-mails.
- Os agendados saem pelo `/api/tick` (agendador externo a cada 1 min) e pelo `/api/cron/all`.

## Anúncios e ROAS

Admin → Anúncios e ROAS. `META_ADS_ACCESS_TOKEN` (ads_read) + IDs das contas. Importa gasto diário por campanha (Marketing API, a cada 30 min, últimos 3 dias; botão para 30 dias), converte USD → BRL pela PTAX de venda do Banco Central do dia (ou cotação manual) + IOF configurável, e compara com as vendas confirmadas (PIX pago, crediário aprovado): ROAS da Meta (vendas com origem facebook/instagram), ROAS geral, CPA, por campanha (casada por `utm_id` ou nome) e por dia.

## Tracking

- **Próprio** (`VisitorSession` + `TrackingEvent`): visitor_id (cookie `cf_vid`, 1 ano), sessão de 30 min, UTMs first/last touch, `fbclid`/`gclid`/`ttclid`, `adset`/`ad`, dispositivo. Eventos do navegador vão em lote para `/api/track`; eventos críticos (pedido, PIX, compra, crediário) são gravados no servidor e ligados à mesma sessão.
- Eventos: `page_view, product_view, offer_view, offer_selected, cta_click, checkout_started, payment_method_selected, payment_started, pix_generated, pix_copied, order_created, purchase, payment_failed, payment_expired, crediario_started, crediario_protocol_completed, crediario_data_completed, crediario_installment_selected, crediario_order_created, crediario_pending, crediario_approved, crediario_rejected…` (lista em `src/lib/domain.ts`).
- **Online agora**: batimento a cada 30 s (`/api/ping`) — admin mostra página atual, dispositivo, origem, campanha e tempo de sessão.
- **Meta Pixel + CAPI**: PageView, ViewContent, InitiateCheckout, AddPaymentInfo, Purchase. Purchase só após confirmação (PIX pago / crediário aprovado), com o mesmo `event_id` no navegador e no servidor (deduplicação). Tokens CAPI só no servidor.
- **Google**: GA4, Google Ads e GTM — uma implementação de cada tag, IDs validados (sem scripts arbitrários).
- **UTMs** (source, medium, campaign, content, term, `utm_id`/`campaign_id`, conjunto e anúncio, fbclid/gclid/ttclid) acompanham sessão, pedido (`Order` + `UtmData`), cobrança PIX (enviadas à BravoPay) e compra — verificados no E2E.
- Aviso de cookies com aceitar / recusar / configurar (modelo de recusa, como no HAMA); não aparece no checkout.

## Segurança

- **Cabeçalhos**: CSP restrita, HSTS (2 anos), X-Frame-Options/frame-ancestors (sem iframe), nosniff, Referrer-Policy, Permissions-Policy, COOP.
- **Borda (middleware)**: caminhos de varredura (`/wp-admin`, `/.env`, `/.git`, `*.php`…) respondem 404 sem tocar no app — `src/lib/security.ts`.
- **Formulários de compra** (checkout, checkout abandonado, rastreio, upsell): mesma origem obrigatória, rate limit por IP, clientes de script (curl, python…) recusados em produção, campo isca + tempo mínimo de preenchimento no checkout.
- **Anti-abuso de PIX** (persistente, no banco): no máximo 8 pedidos por IP em 15 min e 5 PIX em aberto por e-mail em 1 h.
- **Admin**: bcrypt, sessão httpOnly de 12 h, bloqueio persistente após tentativas, papéis, auditoria; dados do crediário cifrados (AES-256-GCM).
- **Firewall da Vercel** (complementar): regras de bloqueio de varreduras, limites no checkout/login, OWASP (SQLi, XSS, RCE, LFI/RFI, scanners) e bloqueio de robôs de IA — exige abrir a aba Firewall do projeto uma vez para a Vercel criar a configuração.
- Robôs legítimos (Google, Meta, WhatsApp) veem o mesmo site que os clientes.

## Admin

`/admin` — login com bcrypt, sessão httpOnly de 12 h, bloqueio após tentativas, papéis OWNER/ADMIN/EDITOR, auditoria de todas as alterações.

Dashboard (PIX e crediário separados, gráficos, filtro de período) · Funil · Métricas (pagamentos e UTMs) · Tracking e online · Pedidos (com rastreio da entrega) · Clientes · Produtos (subtítulo, CTA, destaque, ordem, imagens principal/secundária/galeria) · Kits e preços · Ofertas → Order bump e Upsell · Imagens (upload de arquivo **ou** URL) · Landing page (ordem, visibilidade, cor de fundo e conteúdo de cada seção; "Como usar" com imagem por passo e vídeo vertical) · Depoimentos · FAQ · Pagamentos (PIX, Crediário) · Webhooks · Configurações (marca, empresa, aparência, checkout, entrega, tracking, SEO, políticas, sistema) · Auditoria · Usuários.

**Imagens**: todo campo de imagem tem *Enviar arquivo* (escolher ou arrastar), *Usar URL* (guardar uma cópia otimizada no site ou usar o link direto) e *Biblioteca*. Links internos/privados são bloqueados (proteção SSRF).

## Deploy (Vercel)

1. Criar o projeto na Vercel a partir deste repositório (framework Next.js; build `npm run build` já roda `prisma migrate deploy`).
2. Criar o banco (Neon pela integração da Vercel ou externo) e definir `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.
3. Cadastrar as variáveis do `.env.example` (Production). Gere `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` e `CRON_SECRET` novos — não reutilize os de outros projetos.
4. Primeiro deploy → rodar o seed uma vez localmente apontando para o banco de produção (`npm run db:seed`) ou cadastrar o conteúdo pelo admin.
5. Cadastrar o webhook na BravoPay e o `BRAVOPAY_WEBHOOK_SECRET`.
6. Domínio próprio em Vercel → Domains (HTTPS automático) e `NEXT_PUBLIC_SITE_URL` com o domínio final.
7. Jobs: Vercel Cron diário já está em `vercel.json`; para reconciliação frequente, configure os secrets `SITE_URL`/`CRON_SECRET` no GitHub (workflow `jobs`) ou um agendador externo chamando `GET /api/tick` a cada 1–5 min.

Trocar de banco (ex.: do temporário para o permanente): renomeie as variáveis antigas para `LEGACY_DATABASE_URL`, conecte o novo banco (que cria `DATABASE_URL`), publique de novo (as migrations rodam no build) e chame `GET /api/cron/migrate-legacy` com `Authorization: Bearer <CRON_SECRET>` — copia todos os dados, inclusive imagens.

Recuperar acesso ao admin: defina `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` e chame `GET /api/cron/reset-admin` com `Authorization: Bearer <CRON_SECRET>`.

## Migrations e manutenção

- Nova alteração de schema: `npm run db:migrate:dev -- --name descricao` (gera a migration) e commit. Em produção o build aplica com `prisma migrate deploy`.
- Logs: JSON estruturado nos Runtime Logs da Vercel, com campos sensíveis mascarados.
- Limpeza automática (job): sessões admin expiradas, tentativas de login antigas, analytics com mais de 13 meses.
- Pendências que dependem de informação real da empresa: [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
