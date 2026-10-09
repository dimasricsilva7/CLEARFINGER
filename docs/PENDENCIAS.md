# Pendências (dependem de informação ou ação do dono da marca)

Nada aqui foi inventado no site — enquanto não forem preenchidos, os campos simplesmente não aparecem.

## Essencial antes de anunciar
- [ ] **DNS na Namecheap** (Advanced DNS): registro A `@` → `216.198.79.1` e CNAME `www` → `cname.vercel-dns.com`. O site principal é `https://www.clearfingerbr.shop`.
- [ ] **Caixa de e-mail** `contato@clearfingerbr.shop` (usada no rodapé, contato, políticas e como resposta dos e-mails): criar na Namecheap (Private Email) ou redirecionar para o seu Gmail em Domain → Redirect Email.
- [ ] **Firewall da Vercel**: abrir Vercel → projeto clearfinger → aba **Firewall** uma vez (cria a configuração) e me avisar para aplicar as regras.
- [ ] **Verificação de domínio da Meta**: Business Manager → Segurança da marca → Domínios → adicionar `clearfingerbr.shop` → copiar o código da meta-tag e colar em Admin → Configurações → Tracking → "Verificação de domínio da Meta".
- [ ] **BravoPay webhook**: cadastrar `https://www.clearfingerbr.shop/api/webhooks/bravopay` no painel BravoPay e colocar o segredo em `BRAVOPAY_WEBHOOK_SECRET` (Vercel). Sem ele, o PIX pago só é confirmado pela consulta periódica.
- [ ] **Trocar a chave da API BravoPay** (foi compartilhada em conversa) e atualizar `BRAVOPAY_API_KEY`.
- [ ] **E-mails (Resend)**: criar conta em resend.com, adicionar o domínio `clearfingerbr.shop` e criar na Namecheap os registros DNS que a Resend mostrar; depois cadastrar na Vercel `RESEND_API_KEY` e `EMAIL_FROM` = `CLEARFINGER <pedidos@clearfingerbr.shop>`. Testar em Configurações → E-mails → Enviar teste.
- [ ] **Agendador a cada 1 minuto**: em cron-job.org (grátis), criar um job `GET https://www.clearfingerbr.shop/api/tick` a cada 1 min. É o que faz o lembrete de PIX sair em 10 min, a recuperação de checkout em 30 min, a confirmação de PIX pago sem webhook e a linha do tempo de entrega. (O GitHub Actions já está configurado, mas roda com atraso.)
- [ ] **Meta Ads (ROAS)**: gerar um token de Usuário do Sistema no Business Manager com permissão `ads_read` nas contas de anúncio e cadastrar em `META_ADS_ACCESS_TOKEN` (Vercel). Informar em Admin → Anúncios e ROAS o(s) ID(s) da conta que anuncia a CLEARFINGER. Contas encontradas (todas em USD): CONTA 02 -02/08 (1800271297818384) e CONTA 03 - 02/08 (2608047479647175) ativas; ANUNCIANTE 01, CONTA 01 e 1317733996487908 com pagamento pendente.
- [ ] **Parâmetros de URL** em todos os anúncios (Admin → Anúncios e ROAS mostra o texto para copiar).
- [ ] **DNS na Namecheap** (Advanced DNS): registro A `@` → `216.198.79.1` e CNAME `www` → `cname.vercel-dns.com`.

## Conteúdo
- [x] Dados da empresa, frete grátis (3 a 5 dias úteis), preços dos kits.
- [ ] Endereço e horário de atendimento (opcionais) — Configurações → Empresa e contato.
- [ ] Revisar as políticas (privacidade, termos, troca/devolução) — Configurações → Políticas.
- [ ] Order bump "+1 frasco" está a R$ 39,90 (igual ao kit de 1 unidade) — ajustar ou desativar.
- [ ] Imagem própria do kit de 3 (opcional, como a do kit de 2) — Admin → Kits e preços.
- [ ] HAND CARE e ODOR CONTROL: foto real, preço e descrição (criados inativos) — Produtos; depois ativar bumps/upsell.
- [ ] Fotos e vídeo reais do "Como usar" (as atuais são ilustrativas) e depoimentos reais autorizados.
- [ ] FAQs inativas com `[PREENCHER]` — Admin → FAQ.
- [ ] A embalagem diz "Dermatologicamente testado": manter na foto só se houver laudo.
- [ ] Definir quem aprova o crediário e em quanto tempo; ajustar a mensagem de sucesso.
