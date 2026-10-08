# Pendências (dependem de informação ou ação do dono da marca)

Nada aqui foi inventado no site — enquanto não forem preenchidos, os campos simplesmente não aparecem.

## Conteúdo e empresa
- [x] Razão social, CNPJ, e-mail e WhatsApp — Clear Industria e Comercio de Produtos LTDA · 57.732.599/0001-75 · contato@clearfinger.shop · (11) 4230-5480.
- [ ] Endereço e horário de atendimento (opcionais) — Admin → Configurações → Empresa e contato.
- [ ] Revisar as políticas (privacidade, termos, troca/devolução) — Configurações → Políticas.
- [ ] Conferir os passos do "Como usar" com as instruções reais do rótulo — Landing page → Como funciona. As fotos atuais são ilustrativas (Unsplash); troque por fotos reais quando houver.
- [ ] FAQs inativas com `[PREENCHER]`: frequência de uso, como solicitar devolução — Admin → FAQ.
- [x] Frete grátis para todo o Brasil, entrega em 3 a 5 dias úteis — Configurações → Entrega.
- [x] Preços dos kits: R$ 39,90 / 59,90 (Mais vendido) / 89,90 (Tratamento completo) — Admin → Kits e preços.
- [ ] Order bump "+1 frasco" está a R$ 39,90 — igual ao kit de 1 unidade; ajuste o preço ou desative — Admin → Ofertas → Order bump.
- [ ] CLEARFINGER HAND CARE e CLEARFINGER ODOR CONTROL: foto real, preço e descrição (criados inativos com preço provisório) — Admin → Produtos; depois ative os bumps/upsell — Admin → Ofertas.
- [ ] A embalagem diz "Dermatologicamente testado": mantenha na foto somente se houver laudo.

## Mídia real
- [ ] Vídeo vertical real de aplicação — Landing page → Como funciona (campo de vídeo) ou Demonstração.
- [ ] Depoimentos reais e autorizados — Admin → Depoimentos.

## Integrações / deploy
- [x] Projeto na Vercel + banco Neon permanente + variáveis; domínio clearfinger.shop com HTTPS.
- [ ] BravoPay: cadastrar o webhook `https://clearfinger.shop/api/webhooks/bravopay` e colocar o segredo em `BRAVOPAY_WEBHOOK_SECRET`. Trocar a chave da API (foi compartilhada em conversa).
- [ ] DNS do `www.clearfinger.shop`: CNAME `www` → `cname.vercel-dns.com` no registrador (Namecheap); a Vercel já redireciona www → domínio principal.
- [ ] Agendador externo chamando `GET /api/tick` a cada 1–5 min (ou secrets do workflow `jobs` no GitHub) — deixa a linha do tempo de entrega pontual mesmo sem visitas.
- [ ] Definir como o crediário é analisado/aprovado na operação (quem aprova e em quanto tempo) e ajustar a mensagem de sucesso.
- [ ] (Opcional) E-mails transacionais — o HAMA tem a implementação com Resend pronta para ser trazida.
