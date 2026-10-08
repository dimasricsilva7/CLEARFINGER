# Auditoria dos projetos de referência e decisões do CLEARFINGER

Análise feita em 07/10/2026 sobre `MONTEZ-TOALHAS` e `HAMA-BEADS` (somente leitura — nenhum dos dois foi alterado).

## O que os dois projetos têm em comum

Mesma stack nos dois: Next.js 15.5 (App Router + Server Actions), React 19, Prisma 6.19 + PostgreSQL (Neon), Tailwind 3.4, zod, bcryptjs, qrcode, deploy na Vercel (`iad1`) com Vercel Cron diário + GitHub Actions. O HAMA foi construído a partir do MONTEZ e evoluiu mais.

## Comparação por funcionalidade

| Funcionalidade | MONTEZ | HAMA BEADS | Usado no CLEARFINGER |
|---|---|---|---|
| Pedidos / checkout | carrinho + checkout PIX | igual, com idempotência por `checkoutToken`, snapshot, renovação de PIX vencido | **HAMA** (sem carrinho: oferta → checkout) |
| BravoPay | adaptador | adaptador isolado + `paymentService` + modo mock bloqueado em produção | **HAMA** (copiado, só nomes trocados) |
| Webhook | não cadastrado (só reconciliação) | HMAC `t=,v1=`, anti-replay, `WebhookEvent` idempotente, reprocessamento | **HAMA** |
| Status de pagamento | — | ponto único `applyPaymentSnapshot`, transições, valor pago ≥ total | **HAMA** + crediário isolado |
| Reconciliação | `/api/tick` + tráfego | `/api/tick`, cron, oportunista via `after()` | **HAMA** |
| Auth admin | sessão + bcrypt | igual + papéis OWNER/ADMIN/EDITOR, `LoginAttempt` persistente, bootstrap por env, reset por cron | **HAMA** |
| Auditoria | sim | com diff antes/depois | **HAMA** |
| CMS da landing | `SiteContent` chave/valor | `LandingSection` por seção (ordem, visibilidade, config JSON) | **HAMA**, com tipos de seção novos |
| Imagens | **bytes no Postgres + `/media/[id].webp` + CDN**, upload e import por link com SSRF guard | Vercel Blob (bloqueado no time desde 06/10) | **MONTEZ** (Blob está suspenso) |
| Tracking próprio | sessão + eventos | sessão + eventos, first/last touch, fila em lote, online agora | **HAMA** + `adset`/`ad`, `offerId` |
| Meta Pixel / CAPI | 2 pixels + CAPI | multi-pixel, CAPI com `event_id` deduplicado, consentimento | **HAMA** |
| Google | GA4 | GA4 | **HAMA** + Google Ads e GTM |
| Dashboard / funil | básico | dashboard, funil por dia, aquisição, online agora | **HAMA**, separando PIX e crediário |
| Cookies | — | banner com modelo de recusa | **HAMA** + botão "Configurar" |
| E-mails transacionais | Resend | Resend + agendamento | não incluído (fora do escopo pedido; ver pendências) |

## Decisões

- **Base: HAMA BEADS**; **mídia: MONTEZ**. Nenhuma integração foi reescrita do zero — PIX, webhook, reconciliação, auth, auditoria, tracking e CAPI são o código já validado em produção, adaptado.
- **Crediário** (novo, não existia nas referências): método próprio sem gateway, com estados `CREDIARIO_*`, validação compartilhada navegador/servidor, dados cifrados com AES-256-GCM e textos 100% vindos do admin.
- **Entrega separada do pagamento** (`fulfillmentStatus`), para que o status do crediário continue visível depois do envio.
- **Sem carrinho, cupons, upsell, order bump e testes A/B**: a operação é de produto único com kits; menos passos no checkout. A arquitetura do HAMA para esses recursos pode ser trazida depois se necessário.
- **Imagens da marca**: as fotos de antes/depois e o banner recebidos aparentam ser gerados por IA e trazem afirmações não verificadas ("resultados visíveis", "PIX e cartão de crédito") — não foram usados. A seção de demonstração só aparece com material real e exige confirmação no admin.
