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
  company_name: "",
  company_document: "",
  contact_email: "",
  contact_phone: "",
  whatsapp: "",
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
  shipping_flat_cents: "0",
  shipping_label: "Envio para todo o Brasil",
  shipping_note: "",
  // Checkout
  checkout_title: "Finalizar pedido",
  checkout_security_text: "Seus dados são protegidos e usados apenas para processar e entregar o seu pedido.",
  checkout_submit_label: "Continuar",
  require_cpf: "true",
  marketing_consent_label: "Aceito receber novidades e informações sobre meu pedido por WhatsApp e e-mail.",
  // PIX
  pix_enabled: "true",
  pix_method_label: "PIX",
  pix_description: "Aprovação imediata. Geramos o QR Code e o código copia e cola na próxima tela.",
  pix_button_label: "Gerar PIX",
  pix_expiration_minutes: "30",
  pix_discount_text: "",
  // CREDIÁRIO (protocolo — NÃO é cartão)
  crediario_enabled: "true",
  crediario_method_label: "Crediário",
  crediario_section_title: "Pagamento pelo crediário",
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
  // Políticas (modelos iniciais — revisar com o jurídico; [PREENCHER] = dado real da empresa)
  policy_privacy: `[PREENCHER] Política de Privacidade

Este texto é um modelo inicial e precisa ser revisado com os dados reais da empresa.

1. Quais dados coletamos
Nome, WhatsApp, e-mail, CPF e endereço de entrega, informados por você no checkout. No pagamento pelo crediário, também registramos o número do protocolo, a validade e os 3 últimos dígitos do CPF, usados exclusivamente para a análise do pedido. Registramos ainda dados de navegação anônimos (páginas vistas, origem da visita e dispositivo).

2. Para que usamos
Processar e entregar o pedido, gerar o pagamento PIX junto ao processador de pagamentos, analisar pedidos no crediário, prestar atendimento e, somente com o seu consentimento, enviar novidades.

3. Compartilhamento
Com o processador de pagamentos (PIX), com a transportadora e, se você não recusar os cookies de marketing, com plataformas de anúncios (Meta, Google). Dados do crediário nunca são enviados a plataformas de anúncios.

4. Seus direitos (LGPD)
Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail de contato.

5. Controlador
[PREENCHER razão social, CNPJ e e-mail].`,
  policy_terms: `[PREENCHER] Termos de Uso

Este texto é um modelo inicial e precisa ser revisado com os dados reais da empresa.

Ao comprar neste site você concorda com as condições de venda, prazos e políticas publicadas. Preços e ofertas podem ser alterados sem aviso, sem afetar pedidos já realizados. Pedidos no crediário são confirmados somente após a análise do protocolo informado.`,
  policy_returns: `[PREENCHER] Política de Troca e Devolução

Este texto é um modelo inicial e precisa ser revisado com os dados reais da empresa.

Compras online podem ser canceladas em até 7 dias corridos após o recebimento (art. 49 do Código de Defesa do Consumidor). Produtos com defeito podem ser trocados conforme a legislação. Para solicitar, entre em contato pelos canais de atendimento informando o número do pedido.`,
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
