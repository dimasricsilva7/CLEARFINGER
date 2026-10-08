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
| Deploy | Vercel (região `iad1`), cron diário + GitHub Actions a cada 5 min |

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

## Tracking

- **Próprio** (`VisitorSession` + `TrackingEvent`): visitor_id (cookie `cf_vid`, 1 ano), sessão de 30 min, UTMs first/last touch, `fbclid`/`gclid`/`ttclid`, `adset`/`ad`, dispositivo. Eventos do navegador vão em lote para `/api/track`; eventos críticos (pedido, PIX, compra, crediário) são gravados no servidor e ligados à mesma sessão.
- Eventos: `page_view, product_view, offer_view, offer_selected, cta_click, checkout_started, payment_method_selected, payment_started, pix_generated, pix_copied, order_created, purchase, payment_failed, payment_expired, crediario_started, crediario_protocol_completed, crediario_data_completed, crediario_installment_selected, crediario_order_created, crediario_pending, crediario_approved, crediario_rejected…` (lista em `src/lib/domain.ts`).
- **Online agora**: batimento a cada 30 s (`/api/ping`) — admin mostra página atual, dispositivo, origem, campanha e tempo de sessão.
- **Meta Pixel + CAPI**: PageView, ViewContent, InitiateCheckout, AddPaymentInfo, Purchase. Purchase só após confirmação (PIX pago / crediário aprovado), com o mesmo `event_id` no navegador e no servidor (deduplicação). Tokens CAPI só no servidor.
- **Google**: GA4, Google Ads e GTM — uma implementação de cada tag, IDs validados (sem scripts arbitrários).
- **UTMs** acompanham sessão, pedido (`Order` + `UtmData`), cobrança PIX (enviadas à BravoPay) e compra.
- Aviso de cookies com aceitar / recusar / configurar (modelo de recusa, como no HAMA); não aparece no checkout.

## Admin

`/admin` — login com bcrypt, sessão httpOnly de 12 h, bloqueio após tentativas, papéis OWNER/ADMIN/EDITOR, auditoria de todas as alterações.

Dashboard (PIX e crediário separados, gráficos, filtro de período) · Funil · Métricas (pagamentos e UTMs) · Tracking e online · Pedidos · Clientes · Produtos (imagens principal/secundária/galeria) · Ofertas e kits · Imagens (upload de arquivo **ou** URL) · Landing page (ordem, visibilidade e conteúdo de cada seção) · Depoimentos · FAQ · Pagamentos (PIX, Crediário) · Webhooks · Configurações (marca, empresa, aparência, checkout/envio, tracking, SEO, políticas, sistema) · Auditoria · Usuários.

**Imagens**: todo campo de imagem tem *Enviar arquivo* (escolher ou arrastar), *Usar URL* (guardar uma cópia otimizada no site ou usar o link direto) e *Biblioteca*. Links internos/privados são bloqueados (proteção SSRF).

## Deploy (Vercel)

1. Criar o projeto na Vercel a partir deste repositório (framework Next.js; build `npm run build` já roda `prisma migrate deploy`).
2. Criar o banco (Neon pela integração da Vercel ou externo) e definir `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.
3. Cadastrar as variáveis do `.env.example` (Production). Gere `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` e `CRON_SECRET` novos — não reutilize os de outros projetos.
4. Primeiro deploy → rodar o seed uma vez localmente apontando para o banco de produção (`npm run db:seed`) ou cadastrar o conteúdo pelo admin.
5. Cadastrar o webhook na BravoPay e o `BRAVOPAY_WEBHOOK_SECRET`.
6. Domínio próprio em Vercel → Domains (HTTPS automático) e `NEXT_PUBLIC_SITE_URL` com o domínio final.
7. Jobs: Vercel Cron diário já está em `vercel.json`; para reconciliação frequente, configure os secrets `SITE_URL`/`CRON_SECRET` no GitHub (workflow `jobs`) ou um agendador externo chamando `GET /api/tick` a cada 1–5 min.

Recuperar acesso ao admin: defina `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` e chame `GET /api/cron/reset-admin` com `Authorization: Bearer <CRON_SECRET>`.

## Migrations e manutenção

- Nova alteração de schema: `npm run db:migrate:dev -- --name descricao` (gera a migration) e commit. Em produção o build aplica com `prisma migrate deploy`.
- Logs: JSON estruturado nos Runtime Logs da Vercel, com campos sensíveis mascarados.
- Limpeza automática (job): sessões admin expiradas, tentativas de login antigas, analytics com mais de 13 meses.
- Pendências que dependem de informação real da empresa: [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
