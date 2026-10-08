# Pendências (dependem de informação ou ação do dono da marca)

Nada aqui foi inventado no site — enquanto não forem preenchidos, os campos simplesmente não aparecem.

## Conteúdo e empresa
- [ ] Razão social, CNPJ, endereço, e-mail, WhatsApp e horário de atendimento — Admin → Configurações → Empresa e contato.
- [ ] Revisar as políticas (privacidade, termos, troca/devolução) e remover os `[PREENCHER]` — Configurações → Políticas.
- [ ] Instruções reais de uso para os passos "Aplique / Limpe / Finalize" — Landing page → Como funciona.
- [ ] FAQs inativas com `[PREENCHER]`: frequência de uso, prazo de entrega, como solicitar devolução — Admin → FAQ.
- [ ] Prazo e política de frete reais (frete fixo, selo "Envio para todo o Brasil") — Configurações → Checkout e envio.
- [ ] Confirmar os preços dos kits (valores iniciais de exemplo: R$ 59,90 / 99,90 / 134,90) — Admin → Ofertas.
- [ ] A embalagem diz "Dermatologicamente testado": mantenha na foto somente se houver laudo.

## Mídia real
- [ ] Vídeo vertical real de aplicação e fotos reais de antes/aplicação/depois (com autorização) — Landing page → Demonstração.
- [ ] Depoimentos reais e autorizados — Admin → Depoimentos.

## Integrações / deploy
- [ ] Projeto na Vercel + banco de produção + variáveis (ver README → Deploy).
- [ ] BravoPay: `BRAVOPAY_API_KEY` e cadastro do webhook `https://SEU-DOMINIO/api/webhooks/bravopay` → `BRAVOPAY_WEBHOOK_SECRET` (o segredo é por endpoint; o de outro projeto não serve).
- [ ] Meta Pixel ID(s) e tokens da Conversions API; GA4 / Google Ads / GTM se usados.
- [ ] Agendador externo chamando `GET /api/tick` a cada 1–5 min (ou secrets do workflow `jobs` no GitHub).
- [ ] Definir como o crediário é analisado/aprovado na operação (quem aprova e em quanto tempo) e ajustar a mensagem de sucesso.
- [ ] (Opcional) E-mails transacionais — o HAMA tem a implementação com Resend pronta para ser trazida.
