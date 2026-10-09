/**
 * Templates de e-mail no visual da CLEARFINGER (fundo azul-claro, cartão branco, faixa navy/azul,
 * títulos em Sora, botão azul arredondado, foto oficial do produto).
 * HTML de tabelas com estilos inline — compatível com Gmail, Outlook e Apple Mail.
 * Textos editáveis em Admin → Configurações → E-mails ({nome}, {pedido} são substituídos).
 */

export type EmailBrand = {
  store: string;
  tagline: string;
  logoUrl: string;
  productImageUrl: string;
  siteUrl: string;
  primary: string;
  navy: string;
  background: string;
  whatsappUrl: string | null;
  whatsappLabel: string | null;
  contactEmail: string | null;
  companyLine: string | null;
  shippingLabel: string | null;
  shippingEta: string | null;
};

export type EmailOrder = {
  orderNumber: string;
  firstName: string;
  paymentLabel: string;
  items: { name: string; detail: string; quantity: number; totalCents: number; kind: string }[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  pixCopyPaste: string | null;
  pixExpiresAt: Date | null;
  /** PIX vencido/inexistente: o botão leva à página do pedido, que gera um código novo */
  pixExpired: boolean;
  address: string | null;
};

export type EmailTexts = { subject: string; title: string; text: string; button: string };

const INK = "#0F1B2D";
const MUTED = "#5B6B80";
const LINE = "#E3EAF3";
const SUCCESS = "#14804A";
const DISPLAY = "Sora,'Segoe UI',Arial,Helvetica,sans-serif";
const BODY = "Manrope,'Segoe UI',Arial,Helvetica,sans-serif";

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100).replace(/\s/g, " ");
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Substitui {nome} e {pedido} e escapa o resultado. */
const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(nome|pedido)\}/g, (_, k: string) => vars[k] ?? "");
const paragraphs = (s: string) =>
  s
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;font-family:${BODY};font-size:15px;line-height:1.6;color:${MUTED}">${esc(p)}</p>`)
    .join("");
const dateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", " às");

function button(b: EmailBrand, href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 6px"><tr><td align="center" bgcolor="${b.primary}" style="border-radius:14px;box-shadow:0 8px 20px -8px ${b.primary}">
<a href="${esc(href)}" target="_blank" style="display:block;padding:17px 24px;font-family:${BODY};font-size:15px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:14px">${esc(label)}</a></td></tr></table>`;
}

function eyebrow(b: EmailBrand, text: string, color?: string) {
  return `<p style="margin:0 0 10px;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;color:${color ?? b.primary}">${esc(text)}</p>`;
}

function title(text: string) {
  return `<h1 style="margin:0 0 14px;font-family:${DISPLAY};font-size:26px;line-height:1.25;font-weight:700;color:${INK};letter-spacing:-.3px">${esc(text)}</h1>`;
}

function shippingStrip(b: EmailBrand) {
  if (!b.shippingLabel && !b.shippingEta) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0"><tr><td style="background:#EEF8F2;border:1px solid #CDEBD9;border-radius:12px;padding:12px 16px;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:${INK}">
&#128666;&nbsp; ${esc(b.shippingLabel ?? "")}${b.shippingLabel && b.shippingEta ? `<span style="color:${MUTED};font-weight:700"> · entrega de ${esc(b.shippingEta)}</span>` : b.shippingEta ? `entrega de ${esc(b.shippingEta)}` : ""}
</td></tr></table>`;
}

function productBlock(b: EmailBrand, caption?: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 4px"><tr><td align="center" style="background:#ffffff;border:1px solid ${LINE};border-radius:18px;padding:18px 12px 10px">
<img src="${esc(b.productImageUrl)}" width="220" alt="${esc(b.store)}" style="display:block;width:220px;max-width:70%;height:auto;border:0;margin:0 auto">
${caption ? `<p style="margin:8px 0 0;font-family:${BODY};font-size:13px;color:${MUTED}">${esc(caption)}</p>` : ""}
</td></tr></table>`;
}

function itemsTable(o: EmailOrder) {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;line-height:1.4;color:${INK}">
<strong>${i.kind === "OFFER" ? "" : "+ "}${esc(i.name)}</strong>${i.detail ? `<br><span style="color:${MUTED};font-size:13px">${esc(i.detail)}</span>` : ""}</td>
<td align="right" valign="top" style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;color:${INK};white-space:nowrap">${brl(i.totalCents)}</td></tr>`
    )
    .join("");
  const line = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) =>
    `<tr><td style="padding:${opts.bold ? 14 : 8}px 0 0;font-family:${BODY};font-size:${opts.bold ? 15 : 14}px;color:${opts.bold ? INK : MUTED};font-weight:${opts.bold ? 800 : 500}">${label}</td>
<td align="right" style="padding:${opts.bold ? 14 : 8}px 0 0;font-family:${opts.bold ? DISPLAY : BODY};font-size:${opts.bold ? 22 : 14}px;color:${opts.color ?? INK};font-weight:${opts.bold ? 700 : 600};white-space:nowrap">${value}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px">${rows}
${o.discountCents > 0 ? line("Desconto", `− ${brl(o.discountCents)}`, { color: SUCCESS }) : ""}
${line("Frete", o.shippingCents > 0 ? brl(o.shippingCents) : "Grátis", { color: o.shippingCents > 0 ? INK : SUCCESS })}
${line("Total", brl(o.totalCents), { bold: true })}</table>`;
}

function infoBox(rows: [string, string][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;background:#F7FAFD;border:1px solid ${LINE};border-radius:14px">
${rows.map(([k, v]) => `<tr><td style="padding:12px 16px 0;font-family:${BODY};font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED}">${esc(k)}</td></tr><tr><td style="padding:3px 16px 12px;font-family:${BODY};font-size:14px;line-height:1.5;color:${INK}">${esc(v)}</td></tr>`).join("")}
</table>`;
}

function layout(b: EmailBrand, o: { preheader: string; content: string; unsubscribeUrl?: string; reason: string }) {
  const contact = [
    b.whatsappUrl ? `<a href="${esc(b.whatsappUrl)}" style="color:${b.primary};text-decoration:none;font-weight:700">WhatsApp${b.whatsappLabel ? ` ${esc(b.whatsappLabel)}` : ""}</a>` : "",
    b.contactEmail ? `<a href="mailto:${esc(b.contactEmail)}" style="color:${b.primary};text-decoration:none;font-weight:700">${esc(b.contactEmail)}</a>` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(b.store)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Sora:wght@600;700&display=swap');
@media (max-width:620px){.cf-card{border-radius:0!important}.cf-pad{padding-left:22px!important;padding-right:22px!important}}</style></head>
<body style="margin:0;padding:0;background:${b.background};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${b.background}"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="cf-card" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:22px;overflow:hidden">
<tr><td align="center" style="padding:26px 24px 20px"><a href="${esc(b.siteUrl)}" target="_blank" style="text-decoration:none"><img src="${esc(b.logoUrl)}" width="180" alt="${esc(b.store)}" style="display:block;width:180px;height:auto;border:0"></a></td></tr>
<tr><td style="font-size:0;line-height:0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="4" width="70%" style="background:${b.navy};font-size:0;line-height:0">&nbsp;</td><td height="4" width="30%" style="background:${b.primary};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
<tr><td class="cf-pad" style="padding:34px 40px 36px">${o.content}</td></tr>
<tr><td style="background:${b.navy};padding:22px 32px;text-align:center">
<p style="margin:0;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#ffffff">Compra segura &nbsp;·&nbsp; PIX ou crediário &nbsp;·&nbsp; Dados protegidos</p>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%"><tr><td align="center" style="padding:22px 20px 0;font-family:${BODY};font-size:12px;line-height:1.7;color:${MUTED}">
${contact ? `<p style="margin:0 0 6px">Dúvidas? Fale com a gente: ${contact}</p>` : ""}
${b.companyLine ? `<p style="margin:0 0 6px">${esc(b.companyLine)}</p>` : ""}
<p style="margin:0">${esc(o.reason)}${o.unsubscribeUrl ? ` <a href="${esc(o.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">Não quero mais receber lembretes</a>.` : ""}</p>
</td></tr></table>
</td></tr></table></body></html>`;
}

function footerText(b: EmailBrand, unsub?: string) {
  return [
    "",
    "—",
    b.store,
    b.whatsappUrl ? `WhatsApp: ${b.whatsappUrl}` : "",
    b.contactEmail ? `E-mail: ${b.contactEmail}` : "",
    b.companyLine ?? "",
    unsub ? `Não quero mais receber lembretes: ${unsub}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ───────────── Confirmação de compra ─────────────

export function purchaseConfirmationEmail(b: EmailBrand, o: EmailOrder, orderUrl: string, trackUrl: string, t: EmailTexts) {
  const vars = { nome: o.firstName, pedido: o.orderNumber };
  const content = `${eyebrow(b, "Pagamento confirmado", SUCCESS)}
${title(fill(t.title, vars))}
${paragraphs(fill(t.text, vars))}
${productBlock(b)}
<p style="margin:22px 0 0;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">Pedido ${esc(o.orderNumber)} · ${esc(o.paymentLabel)}</p>
${itemsTable(o)}
${shippingStrip(b)}
${infoBox([...(o.address ? ([["Entrega em", o.address]] as [string, string][]) : []), ["Próximos passos", "Separamos e enviamos o seu pedido. Você acompanha cada etapa da entrega pelo link abaixo."]])}
${button(b, orderUrl, fill(t.button, vars))}
<p style="margin:10px 0 0;text-align:center;font-family:${BODY};font-size:13px;color:${MUTED}">Ou rastreie a qualquer momento em <a href="${esc(trackUrl)}" style="color:${b.primary};font-weight:700;text-decoration:none">Rastrear pedido</a> com o número do pedido e seu CPF ou e-mail.</p>`;
  const text = [
    fill(t.title, vars),
    "",
    fill(t.text, vars),
    "",
    `Pedido ${o.orderNumber} · ${o.paymentLabel}`,
    ...o.items.map((i) => `${i.kind === "OFFER" ? "" : "+ "}${i.name}${i.detail ? ` (${i.detail})` : ""} — ${brl(i.totalCents)}`),
    `Frete: ${o.shippingCents > 0 ? brl(o.shippingCents) : "Grátis"}`,
    `Total: ${brl(o.totalCents)}`,
    o.address ? `Entrega em: ${o.address}` : "",
    b.shippingEta ? `Prazo: ${b.shippingEta}` : "",
    "",
    `Acompanhar pedido: ${orderUrl}`,
    `Rastrear pedido: ${trackUrl}`,
    footerText(b),
  ]
    .filter((l) => l !== null)
    .join("\n");
  return { subject: fill(t.subject, vars), html: layout(b, { preheader: `Pedido ${o.orderNumber} confirmado — ${brl(o.totalCents)}`, content, reason: "Você recebeu este e-mail porque fez uma compra na loja." }), text };
}

// ───────────── PIX gerado e não pago ─────────────

export function pixRecoveryEmail(b: EmailBrand, o: EmailOrder, orderUrl: string, unsubscribeUrl: string, t: EmailTexts) {
  const vars = { nome: o.firstName, pedido: o.orderNumber };
  const pixBox =
    o.pixCopyPaste && !o.pixExpired
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0"><tr><td style="background:${b.navy};border-radius:18px;padding:22px 20px;text-align:center">
<p style="margin:0;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#A9C8F2">Valor a pagar</p>
<p style="margin:4px 0 0;font-family:${DISPLAY};font-size:34px;font-weight:700;color:#ffffff">${brl(o.totalCents)}</p>
${o.pixExpiresAt ? `<p style="margin:6px 0 0;font-family:${BODY};font-size:13px;color:#C9D8EC">Código válido até ${dateTime(o.pixExpiresAt)}</p>` : ""}
</td></tr>
<tr><td style="padding:14px 0 0">
<p style="margin:0 0 6px;font-family:${BODY};font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED}">PIX copia e cola</p>
<div style="background:#F7FAFD;border:1px dashed #B9CBE2;border-radius:12px;padding:12px 14px;font-family:'Courier New',monospace;font-size:12px;line-height:1.5;color:${INK};word-break:break-all">${esc(o.pixCopyPaste)}</div>
</td></tr></table>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0"><tr><td style="background:${b.navy};border-radius:18px;padding:22px 20px;text-align:center">
<p style="margin:0;font-family:${DISPLAY};font-size:30px;font-weight:700;color:#ffffff">${brl(o.totalCents)}</p>
<p style="margin:6px 0 0;font-family:${BODY};font-size:13px;color:#C9D8EC">O código anterior venceu — gere um novo em 1 toque, mesmo pedido e mesmo valor.</p>
</td></tr></table>`;
  const steps = ["Copie o código PIX (ou abra o pedido)", "No app do banco, escolha PIX copia e cola", "Confirme — a aprovação é automática"]
    .map(
      (s, i) => `<tr><td width="34" valign="top" style="padding:6px 0"><div style="width:26px;height:26px;border-radius:13px;background:#EAF2FC;color:${b.primary};font-family:${DISPLAY};font-size:13px;font-weight:700;line-height:26px;text-align:center">${i + 1}</div></td>
<td style="padding:9px 0 6px;font-family:${BODY};font-size:14px;color:${INK}">${esc(s)}</td></tr>`
    )
    .join("");
  const content = `${eyebrow(b, `Pedido ${o.orderNumber} reservado`)}
${title(fill(t.title, vars))}
${paragraphs(fill(t.text, vars))}
${pixBox}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0">${steps}</table>
${button(b, orderUrl, o.pixExpired ? "Gerar novo PIX" : fill(t.button, vars))}
${shippingStrip(b)}
<p style="margin:18px 0 0;font-family:${BODY};font-size:13px;line-height:1.6;color:${MUTED}">Já pagou? Pode desconsiderar este e-mail — a confirmação chega em instantes.</p>`;
  const text = [
    fill(t.title, vars),
    "",
    fill(t.text, vars),
    "",
    `Pedido ${o.orderNumber} — ${brl(o.totalCents)}`,
    o.pixCopyPaste && !o.pixExpired ? `PIX copia e cola:\n${o.pixCopyPaste}` : "O código anterior venceu. Abra o pedido para gerar um novo.",
    "",
    `Abrir pedido: ${orderUrl}`,
    "Já pagou? Pode desconsiderar este e-mail.",
    footerText(b, unsubscribeUrl),
  ].join("\n");
  return {
    subject: fill(t.subject, vars),
    html: layout(b, { preheader: `Falta só o PIX de ${brl(o.totalCents)} para confirmar o pedido ${o.orderNumber}.`, content, unsubscribeUrl, reason: "Você recebeu este lembrete porque iniciou um pedido na loja." }),
    text,
  };
}

// ───────────── Checkout abandonado (sem pedido) ─────────────

export function checkoutRecoveryEmail(b: EmailBrand, lead: { firstName: string | null; lines: string[]; totalCents: number }, recoveryUrl: string, unsubscribeUrl: string, t: EmailTexts) {
  const vars = { nome: lead.firstName ?? "", pedido: "" };
  const greet = (s: string) => fill(s, vars).replace(/^,\s*/, "").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ");
  const lines = lead.lines
    .map((l) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:14px;color:${INK}">${esc(l)}</td></tr>`)
    .join("");
  const content = `${eyebrow(b, "Seu pedido ficou pela metade")}
${title(greet(t.title))}
${paragraphs(greet(t.text))}
${productBlock(b)}
${lines ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px">${lines}
<tr><td style="padding:14px 0 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-family:${BODY};font-size:15px;font-weight:800;color:${INK}">Total</td><td align="right" style="font-family:${DISPLAY};font-size:22px;font-weight:700;color:${INK}">${brl(lead.totalCents)}</td></tr></table></td></tr></table>` : ""}
${shippingStrip(b)}
${button(b, recoveryUrl, fill(t.button, vars))}
<p style="margin:10px 0 0;text-align:center;font-family:${BODY};font-size:13px;color:${MUTED}">Seus dados e o kit escolhido já estão preenchidos.</p>`;
  const text = [greet(t.title), "", greet(t.text), "", ...lead.lines, lead.totalCents ? `Total: ${brl(lead.totalCents)}` : "", "", `Finalizar compra: ${recoveryUrl}`, footerText(b, unsubscribeUrl)].join("\n");
  return {
    subject: greet(t.subject),
    html: layout(b, { preheader: "Seu kit continua separado — finalize em menos de 1 minuto.", content, unsubscribeUrl, reason: "Você recebeu este lembrete porque preencheu seus dados no checkout." }),
    text,
  };
}
