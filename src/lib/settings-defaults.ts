/**
 * Valores padrão das configurações. Tudo é editável no admin (Configurações e Pagamentos)
 * e salvo na tabela SiteSettings — nada disso exige deploy para mudar.
 * Campos vazios que dependem de dados reais da empresa NÃO aparecem no site até serem preenchidos.
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  // Marca
  store_name: "CLEARFINGER",
  store_tagline: "Removedor de manchas de nicotina para mãos e unhas",
  logo_url: "/brand/logo.webp",
  logo_mark_url: "/brand/logo-circular.webp",
  favicon_url: "/brand/favicon.png",
  // Empresa e contato — preencher com dados reais (vazio = não exibido)
  company_name: "Clear Industria e Comercio de Produtos LTDA",
  company_document: "57.732.599/0001-75",
  contact_email: "contato@clearfingerbr.shop",
  contact_phone: "",
  whatsapp: "1142305480",
  address: "",
  support_hours: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  youtube_url: "",
  // Aparência
  theme_primary: "#1F6FD1",
  theme_navy: "#0B2545",
  theme_background: "#F5F8FC",
  // Layout
  announcement_text: "",
  header_cta_label: "Comprar",
  sticky_cta_enabled: "true",
  sticky_cta_label: "QUERO O MEU CLEARFINGER",
  footer_text: "",
  // Envio
  meta_domain_verification: "",
  google_site_verification: "",
  // Anúncios (Admin → Anúncios e ROAS)
  ads_account_ids: "",
  ads_fx_mode: "ptax",
  ads_fx_manual_rate: "",
  ads_fx_fee_pct: "3.5",
  // E-mails automáticos (Admin → Configurações → E-mails). {nome} e {pedido} são substituídos.
  email_confirmation_enabled: "true",
  email_confirmation_subject: "Pedido {pedido} confirmado ✓",
  email_confirmation_title: "Obrigado, {nome}! Seu pedido está confirmado.",
  email_confirmation_text: "Recebemos o seu pagamento e já estamos preparando o seu CLEARFINGER para envio. Guarde este e-mail: ele tem o resumo do pedido e o link para acompanhar a entrega.",
  email_confirmation_button: "Acompanhar meu pedido",
  email_recovery_enabled: "true",
  email_recovery_delay_minutes: "10",
  email_recovery_subject: "{nome}, falta só o PIX para confirmar seu pedido",
  email_recovery_title: "Seu pedido está reservado, {nome}",
  email_recovery_text: "Vimos que o PIX do pedido {pedido} ainda não foi pago. É rápido: copie o código abaixo, pague no app do seu banco e a confirmação chega na hora.",
  email_recovery_button: "Pagar com PIX agora",
  email_checkout_enabled: "true",
  email_checkout_delay_minutes: "30",
  email_checkout_subject: "{nome}, seu CLEARFINGER ficou no carrinho",
  email_checkout_title: "{nome}, você esqueceu algo",
  email_checkout_text: "Você começou o pedido mas não chegou a finalizar. Separamos o seu kit: é só clicar no botão para concluir — seus dados já estão preenchidos.",
  email_checkout_button: "Finalizar minha compra",
  bump_section_title: "Adicione também ao seu pedido",
  bump_section_text: "Ofertas exclusivas deste pedido. Marque se quiser adicionar.",
  shipping_free_enabled: "true",
  shipping_flat_cents: "0",
  shipping_label: "Frete grátis para todo o Brasil",
  shipping_eta: "3 a 5 dias úteis",
  shipping_eta_text: "Entrega estimada em 3 a 5 dias úteis",
  shipping_checkout_text: "Frete grátis para todo o Brasil · entrega em 3 a 5 dias úteis",
  shipping_note: "",
  // Rastreamento de pedido (timeline automática após o pagamento)
  tracking_auto_enabled: "true",
  tracking_holidays: "",
  tracking_paid_title: "Pagamento concluído",
  tracking_paid_description: "Recebemos a confirmação do seu pagamento.",
  tracking_separating_title: "Separando pedido",
  tracking_separating_description: "Seu pedido foi confirmado e está sendo preparado para envio.",
  tracking_dc_arrived_title: "Pedido chegou ao centro de distribuição",
  tracking_dc_arrived_description: "Seu pedido chegou ao centro de distribuição e está sendo processado.",
  tracking_dispatched_title: "Pedido despachado para a cidade de destino",
  tracking_dispatched_description: "Seu pedido foi encaminhado para a unidade responsável pela entrega na sua região.",
  tracking_dest_dc_arrived_title: "Pedido chegou ao centro de distribuição da cidade destino",
  tracking_dest_dc_arrived_description: "Seu pedido chegou à unidade responsável pela entrega final.",
  tracking_out_for_delivery_title: "Pedido saiu para entrega",
  tracking_out_for_delivery_description: "Seu pedido está a caminho. Aguarde a entrega no endereço informado.",
  tracking_delivered_title: "Pedido entregue",
  tracking_delivered_description: "Seu pedido foi entregue. Aproveite!",
  // Checkout
  checkout_title: "Finalizar pedido",
  checkout_security_text: "Seus dados são protegidos e usados apenas para processar e entregar o seu pedido.",
  checkout_submit_label: "Continuar",
  require_cpf: "true",
  marketing_consent_label: "Aceito receber novidades e informações sobre meu pedido por WhatsApp e e-mail.",
  // PIX
  pix_enabled: "true",
  pix_method_label: "PIX",
  pix_badge: "aprovação imediata",
  pix_description: "Aprovação imediata. Geramos o QR Code e o código copia e cola na próxima tela.",
  pix_button_label: "Gerar PIX",
  pix_expiration_minutes: "30",
  pix_discount_text: "",
  // CREDIÁRIO (protocolo — NÃO é cartão)
  crediario_enabled: "true",
  crediario_method_label: "Crediário",
  crediario_section_title: "Pagamento pelo crediário",
  crediario_method_subtitle: "Em até {parcelas}x · com o protocolo do seu crediário",
  crediario_description: "Use o protocolo do seu crediário. Seu pedido fica registrado e é confirmado após a análise.",
  crediario_protocol_label: "Número do protocolo",
  crediario_protocol_placeholder: "Digite os 16 dígitos do seu protocolo",
  crediario_protocol_digits: "16",
  crediario_protocol_help: "",
  crediario_protocol_error: "Informe os {n} dígitos do protocolo (somente números).",
  crediario_validity_label: "Validade do protocolo",
  crediario_validity_placeholder: "MM/AA",
  crediario_validity_format: "MM/AA",
  crediario_validity_error: "Informe a validade no formato {formato}.",
  crediario_validity_expired_error: "Este protocolo está vencido. Confira a validade.",
  crediario_validity_reject_expired: "true",
  crediario_cpf_label: "3 últimos dígitos do CPF",
  crediario_cpf_placeholder: "Digite os 3 últimos dígitos",
  crediario_cpf_digits: "3",
  crediario_cpf_error: "Informe os {n} últimos dígitos do CPF.",
  crediario_installments_label: "Parcelamento",
  crediario_installments_description: "",
  crediario_max_installments: "2",
  crediario_installment_text: "{n}x de {valor}",
  crediario_help_text: "",
  crediario_error_message: "Não foi possível registrar seu pedido no crediário. Confira os dados e tente novamente.",
  crediario_success_title: "Pedido recebido!",
  crediario_success_message: "Seu pedido foi registrado no crediário e está aguardando análise. Avisaremos você pelo WhatsApp ou e-mail informado.",
  crediario_info_message: "Nenhum valor é cobrado agora. A confirmação acontece após a análise do protocolo.",
  crediario_button_label: "Confirmar pedido no crediário",
  crediario_security_text: "Os dados do protocolo são usados somente para a análise do seu pedido e ficam protegidos.",
  // Rastreamento
  meta_pixel_enabled: "true",
  meta_pixel_id: "",
  meta_capi_enabled: "true",
  ga_enabled: "true",
  ga_id: "",
  gtm_id: "",
  google_ads_id: "",
  google_ads_purchase_label: "",
  cookie_banner_enabled: "true",
  // SEO
  seo_title: "CLEARFINGER — Removedor de manchas de nicotina para mãos e unhas",
  seo_description: "Removedor de manchas de nicotina para mãos e unhas. Ajuda a remover a aparência amarelada dos dedos e unhas. Compra segura com PIX ou crediário.",
  og_image_url: "/brand/kit.webp",
  canonical_url: "",
  robots_index: "true",
  // Políticas (revise com o seu jurídico)
  policy_privacy: `Política de Privacidade

1. Quais dados coletamos
Nome, WhatsApp, e-mail, CPF e endereço de entrega, informados por você no checkout. No pagamento pelo crediário, também registramos o número do protocolo, a validade e os 3 últimos dígitos do CPF, usados exclusivamente para a análise do pedido. Registramos ainda dados de navegação anônimos (páginas vistas, origem da visita e dispositivo).

2. Para que usamos
Processar e entregar o pedido, gerar o pagamento PIX junto ao processador de pagamentos, analisar pedidos no crediário, prestar atendimento e, somente com o seu consentimento, enviar novidades.

3. Compartilhamento
Com o processador de pagamentos (PIX), com a transportadora e, se você não recusar os cookies de marketing, com plataformas de anúncios (Meta, Google). Dados do crediário nunca são enviados a plataformas de anúncios.

4. Seus direitos (LGPD)
Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail contato@clearfingerbr.shop.

5. Controlador
Clear Industria e Comercio de Produtos LTDA, CNPJ 57.732.599/0001-75 — e-mail contato@clearfingerbr.shop, WhatsApp (11) 4230-5480.`,
  policy_terms: `Termos de Uso

Este site é operado por Clear Industria e Comercio de Produtos LTDA, CNPJ 57.732.599/0001-75 — e-mail contato@clearfingerbr.shop, WhatsApp (11) 4230-5480.

Ao comprar neste site você concorda com as condições de venda, prazos e políticas publicadas. Preços e ofertas podem ser alterados sem aviso, sem afetar pedidos já realizados. Pedidos no crediário são confirmados somente após a análise do protocolo informado.`,
  policy_returns: `Política de Troca e Devolução

Compras online podem ser canceladas em até 7 dias corridos após o recebimento (art. 49 do Código de Defesa do Consumidor). Produtos com defeito podem ser trocados conforme a legislação. Para solicitar, entre em contato pelo e-mail contato@clearfingerbr.shop ou pelo WhatsApp (11) 4230-5480 informando o número do pedido — vamos orientar você sobre como fazer a devolução.

Responsável: Clear Industria e Comercio de Produtos LTDA, CNPJ 57.732.599/0001-75 — e-mail contato@clearfingerbr.shop, WhatsApp (11) 4230-5480.`,
  policy_cookies: `Política de Cookies

Usamos cookies essenciais para o funcionamento do site (sessão e segurança) e cookies de medição e marketing (Meta Pixel e Google) para medir e melhorar nossos anúncios. Os cookies de medição e marketing ficam ativos por padrão e você pode recusá-los a qualquer momento pelo aviso de cookies ou pelo link "Preferências de cookies" no rodapé. Depois de recusar, nenhum dado da sua navegação ou compra é enviado ao Meta ou ao Google.`,
};

export const POLICY_PAGES = {
  "politica-de-privacidade": { key: "policy_privacy", title: "Política de Privacidade" },
  termos: { key: "policy_terms", title: "Termos de Uso" },
  "trocas-e-devolucoes": { key: "policy_returns", title: "Política de Troca e Devolução" },
  cookies: { key: "policy_cookies", title: "Política de Cookies" },
} as const;

/** Chaves do crediário (página Pagamentos → Crediário). */
export const CREDIARIO_KEYS = Object.keys(SETTING_DEFAULTS).filter((k) => k.startsWith("crediario_"));
export const PIX_KEYS = Object.keys(SETTING_DEFAULTS).filter((k) => k.startsWith("pix_"));
