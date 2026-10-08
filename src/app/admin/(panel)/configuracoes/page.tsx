import Link from "next/link";
import { Badge, Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/inputs";
import { bravopayMode, envHealth, siteUrl } from "@/lib/env";
import { getSettingsFresh } from "@/server/settings";
import { saveSettings } from "../sistema-actions";

export const metadata = { title: "Configurações" };
type SP = Promise<{ aba?: string }>;

const TABS = { marca: "Marca", empresa: "Empresa e contato", aparencia: "Aparência e layout", checkout: "Checkout e envio", rastreamento: "Tracking (Meta / Google)", seo: "SEO", politicas: "Políticas", sistema: "Sistema" } as const;

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const tab = ((await searchParams).aba ?? "marca") as keyof typeof TABS;
  const s = await getSettingsFresh();
  const text = (key: string, label: string, hint?: string, placeholder?: string) => (
    <Field label={label} hint={hint}><input name={key} defaultValue={s[key]} placeholder={placeholder} className={inputCls} /></Field>
  );
  const check = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name={key} defaultChecked={s[key] === "true"} className="h-4 w-4" /> {label}</label>
  );
  const form = (keys: string[], children: React.ReactNode) => (
    <ActionForm action={saveSettings} className="space-y-4">
      <input type="hidden" name="__keys" value={keys.join(",")} />
      {children}
      <SubmitButton>Salvar</SubmitButton>
    </ActionForm>
  );

  return (
    <div>
      <PageHeader title="Configurações" description="Tudo aqui é salvo no banco e aparece no site na hora, sem deploy." />
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Abas">
        {Object.entries(TABS).map(([k, v]) => (
          <Link key={k} href={`?aba=${k}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${k === tab ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{v}</Link>
        ))}
        <Link href="/admin/pagamentos" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">Pagamentos (PIX / Crediário) →</Link>
      </nav>

      {tab === "marca" && (
        <Card title="Marca">
          {form(
            ["store_name", "store_tagline", "logo_url", "logo_mark_url", "favicon_url"],
            <div className="grid gap-4 md:grid-cols-2">
              {text("store_name", "Nome da marca")}
              {text("store_tagline", "Frase curta (rodapé)")}
              <ImageField name="logo_url" label="Logo (horizontal, fundo transparente)" defaultValue={s.logo_url} category="MARCA" />
              <ImageField name="logo_mark_url" label="Logo circular / selo" defaultValue={s.logo_mark_url} category="MARCA" />
              <ImageField name="favicon_url" label="Favicon (quadrado, 64×64 ou maior)" defaultValue={s.favicon_url} category="MARCA" />
            </div>
          )}
        </Card>
      )}

      {tab === "empresa" && (
        <Card title="Empresa e contato">
          {form(
            ["company_name", "company_document", "address", "contact_email", "contact_phone", "whatsapp", "support_hours", "instagram_url", "facebook_url", "tiktok_url", "youtube_url"],
            <>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Use somente dados reais. Campos vazios não aparecem no site.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {text("company_name", "Razão social")}
                {text("company_document", "CNPJ")}
                {text("address", "Endereço")}
                {text("contact_email", "E-mail de atendimento")}
                {text("whatsapp", "WhatsApp (com DDD)", "Usado nos botões de atendimento", "11912345678")}
                {text("contact_phone", "Telefone")}
                {text("support_hours", "Horário de atendimento")}
                {text("instagram_url", "Instagram (URL)")}
                {text("facebook_url", "Facebook (URL)")}
                {text("tiktok_url", "TikTok (URL)")}
                {text("youtube_url", "YouTube (URL)")}
              </div>
            </>
          )}
        </Card>
      )}

      {tab === "aparencia" && (
        <Card title="Aparência e layout">
          {form(
            ["theme_primary", "theme_navy", "theme_background", "announcement_text", "header_cta_label", "sticky_cta_enabled", "sticky_cta_label", "footer_text"],
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[["theme_primary", "Azul (botões, destaques)"], ["theme_navy", "Azul-marinho (títulos, faixas)"], ["theme_background", "Fundo (cinza claro)"]].map(([k, l]) => (
                  <Field key={k} label={l}>
                    <span className="flex items-center gap-2">
                      <span className="h-10 w-10 shrink-0 rounded-lg border border-slate-300" style={{ background: s[k] }} />
                      <input name={k} defaultValue={s[k]} className={inputCls} />
                    </span>
                  </Field>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {text("announcement_text", "Barra de aviso (topo)", "Vazio = oculta. Não use urgência falsa.")}
                {text("header_cta_label", "Botão do cabeçalho")}
                {text("sticky_cta_label", "CTA fixo no celular")}
                {text("footer_text", "Texto extra do rodapé")}
              </div>
              {check("sticky_cta_enabled", "Mostrar CTA fixo no rodapé do celular")}
            </>
          )}
        </Card>
      )}

      {tab === "checkout" && (
        <Card title="Checkout e envio">
          {form(
            ["checkout_title", "checkout_security_text", "require_cpf", "marketing_consent_label", "shipping_flat_cents", "shipping_label", "shipping_note"],
            <div className="grid gap-4 md:grid-cols-2">
              {text("checkout_title", "Título do checkout")}
              <div className="flex items-end">{check("require_cpf", "Exigir CPF (recomendado para o PIX)")}</div>
              <Field label="Texto de segurança" className="md:col-span-2"><textarea name="checkout_security_text" rows={2} defaultValue={s.checkout_security_text} className={textareaCls} /></Field>
              <Field label="Texto do opt-in de marketing" className="md:col-span-2"><input name="marketing_consent_label" defaultValue={s.marketing_consent_label} className={inputCls} /></Field>
              <Field label="Frete fixo (R$)" hint="0 = frete grátis"><input name="shipping_flat_cents" defaultValue={(Number(s.shipping_flat_cents) / 100).toFixed(2).replace(".", ",")} className={inputCls} /></Field>
              {text("shipping_label", "Selo de envio (checkout)", "Ex.: Envio para todo o Brasil — só se for verdade")}
              {text("shipping_note", "Observação de entrega", "Ex.: prazo estimado — informe só prazos reais")}
            </div>
          )}
        </Card>
      )}

      {tab === "rastreamento" && (
        <Card title="Tracking — Meta Pixel e Google">
          {form(
            ["meta_pixel_enabled", "meta_pixel_id", "meta_capi_enabled", "ga_enabled", "ga_id", "gtm_id", "google_ads_id", "google_ads_purchase_label", "cookie_banner_enabled"],
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {text("meta_pixel_id", "Meta Pixel ID(s)", "Até 3, separados por vírgula. Vazio = NEXT_PUBLIC_META_PIXEL_ID")}
                {text("ga_id", "Google Analytics 4", "G-XXXXXXX. Vazio = NEXT_PUBLIC_GA_ID")}
                {text("gtm_id", "Google Tag Manager", "GTM-XXXXXXX (opcional — não duplique tags que já estão aqui)")}
                {text("google_ads_id", "Google Ads", "AW-123456789")}
                {text("google_ads_purchase_label", "Rótulo da conversão de compra (Google Ads)")}
              </div>
              {check("meta_pixel_enabled", "Meta Pixel ativo (PageView, ViewContent, InitiateCheckout, AddPaymentInfo, Purchase)")}
              {check("meta_capi_enabled", `Conversions API (servidor) — token: ${process.env.META_CAPI_TOKENS || process.env.META_ACCESS_TOKEN ? "configurado" : "NÃO configurado"}`)}
              {check("ga_enabled", "Google ativo (GA4, Google Ads e GTM)")}
              {check("cookie_banner_enabled", "Aviso de cookies (aceitar / recusar / configurar)")}
              <p className="text-xs text-slate-500">Uma única implementação de cada tag (sem duplicação). Purchase só é enviado após confirmação do pagamento PIX ou aprovação do crediário, com o mesmo event_id no Pixel e na CAPI. Dados do crediário (protocolo, validade, CPF) nunca são enviados ao Meta ou ao Google.</p>
            </div>
          )}
        </Card>
      )}

      {tab === "seo" && (
        <Card title="SEO e compartilhamento">
          {form(
            ["seo_title", "seo_description", "og_image_url", "canonical_url", "robots_index"],
            <div className="space-y-4">
              <Field label="Title (até 60)"><input name="seo_title" maxLength={70} defaultValue={s.seo_title} className={inputCls} /></Field>
              <Field label="Meta description (até 160)"><textarea name="seo_description" maxLength={170} rows={3} defaultValue={s.seo_description} className={textareaCls} /></Field>
              <ImageField name="og_image_url" label="Imagem de compartilhamento — OG (1200×630)" defaultValue={s.og_image_url} category="MARCA" />
              {text("canonical_url", "URL canônica", "Vazio = página inicial do domínio atual")}
              {check("robots_index", "Permitir indexação pelos buscadores (robots)")}
              <p className="text-xs text-slate-500">Sitemap: {siteUrl()}/sitemap.xml · robots: {siteUrl()}/robots.txt. O favicon fica na aba Marca.</p>
            </div>
          )}
        </Card>
      )}

      {tab === "politicas" && (
        <Card title="Políticas">
          {form(
            ["policy_privacy", "policy_terms", "policy_returns", "policy_cookies"],
            <div className="space-y-4">
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Os textos iniciais são modelos marcados com [PREENCHER]. Revise com seu jurídico e inclua os dados reais da empresa.</p>
              {[["policy_privacy", "Política de Privacidade"], ["policy_terms", "Termos de Uso"], ["policy_returns", "Troca e Devolução"], ["policy_cookies", "Cookies"]].map(([k, l]) => (
                <Field key={k} label={l}><textarea name={k} rows={10} defaultValue={s[k]} className={`${textareaCls} font-mono text-xs`} /></Field>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "sistema" && <SystemTab />}
    </div>
  );
}

function SystemTab() {
  const env = envHealth();
  const mode = bravopayMode();
  return (
    <div className="space-y-6">
      <Card title="Integrações">
        <ul className="space-y-2 text-sm">
          <li>BravoPay (PIX): {mode === "live" ? <Badge tone="green">produção</Badge> : mode === "mock" ? <Badge tone="amber">modo de teste</Badge> : <Badge tone="red">não configurada</Badge>}</li>
          <li>Webhook: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{siteUrl()}/api/webhooks/bravopay</code></li>
          <li>Jobs: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{siteUrl()}/api/tick</code> (agendador externo a cada 1–5 min) e <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/cron/all</code> (Vercel Cron diário + GitHub Actions)</li>
        </ul>
      </Card>
      <Card title="Variáveis de ambiente (somente presença — valores nunca são exibidos)">
        <ul className="divide-y divide-slate-100 text-sm">
          {env.map((e) => (
            <li key={e.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><code className="font-mono text-xs">{e.key}</code> <span className="text-slate-500">— {e.hint}</span></span>
              {e.ok ? <Badge tone="green">ok</Badge> : e.required ? <Badge tone="red">ausente</Badge> : <Badge>opcional</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
