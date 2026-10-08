"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrediarioFields, EMPTY_CREDIARIO, type CrediarioValue } from "@/components/checkout/CrediarioFields";
import { Icon } from "@/components/ui/Icon";
import { gaEvent, getClientContext, metaEvent, newEventId, randomId, track, trackOnce } from "@/lib/client/tracking";
import { parseValidity, validateCrediario, type CrediarioConfig } from "@/lib/crediario";
import { offerDiscountLabel } from "@/lib/pricing";
import { formatBRL } from "@/utils/format";
import { maskCep, maskCpf, maskPhone, onlyDigits, UF_LIST } from "@/utils/validators";
import type { PublicOffer } from "@/types/catalog";

type Form = { name: string; email: string; phone: string; cpf: string; cep: string; street: string; number: string; complement: string; district: string; city: string; state: string };
const EMPTY: Form = { name: "", email: "", phone: "", cpf: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };
const FORM_KEY = "cf_checkout_form";
const TOKEN_KEY = "cf_checkout_token";

export type CheckoutProps = {
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  volume: string | null;
  offers: PublicOffer[];
  initialOfferId: string;
  shippingCents: number;
  shippingLabel: string;
  shippingNote: string;
  requireCpf: boolean;
  consentLabel: string;
  title: string;
  securityText: string;
  pix: { enabled: boolean; label: string; description: string; button: string };
  crediario: CrediarioConfig;
};

function Field({ id, label, error, children, className = "" }: { id: string; label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function CheckoutClient(p: CheckoutProps) {
  const router = useRouter();
  const [offerId, setOfferId] = useState(p.initialOfferId);
  const offer = p.offers.find((o) => o.id === offerId) ?? p.offers[0];
  const totalCents = offer.priceCents + p.shippingCents;
  const methods = [p.pix.enabled && "PIX", p.crediario.enabled && "CREDIARIO"].filter(Boolean) as ("PIX" | "CREDIARIO")[];
  const [method, setMethod] = useState<"PIX" | "CREDIARIO" | null>(methods.length === 1 ? methods[0] : null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [cred, setCred] = useState<CrediarioValue>(EMPTY_CREDIARIO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const started = useRef(false);

  // Dados do formulário guardados apenas nesta aba (dados do crediário NUNCA são guardados)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(FORM_KEY) ?? "null");
      if (saved) setForm({ ...EMPTY, ...saved });
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  // checkout_started + InitiateCheckout (uma vez)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    metaEvent(
      "InitiateCheckout",
      { value: offer.priceCents / 100, currency: "BRL", num_items: offer.quantity, content_ids: [p.sku], content_type: "product" },
      { mirror: true, internal: { name: "checkout_started", productId: p.productId, offerId: offer.id, valueCents: offer.priceCents } }
    );
    gaEvent("begin_checkout", { currency: "BRL", value: offer.priceCents / 100, items: [{ item_id: p.sku, item_name: `${p.productName} — ${offer.name}`, price: offer.priceCents / 100, quantity: 1 }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _a, ...rest }) => rest);
  };

  const chooseMethod = (m: "PIX" | "CREDIARIO") => {
    setMethod(m);
    setFormError(null);
    track("payment_method_selected", { productId: p.productId, offerId: offer.id, valueCents: totalCents, props: { method: m } });
    if (m === "CREDIARIO") trackOnce("crediario_started", "crediario_started", { offerId: offer.id, valueCents: totalCents });
  };

  // Eventos do crediário — só marcos (nunca o conteúdo digitado)
  const onCred = (v: CrediarioValue, field: keyof CrediarioValue) => {
    setCred(v);
    setErrors(({ [`crediario.${field}`]: _a, ...rest }) => rest);
    if (field === "protocol" && v.protocol.length === p.crediario.protocolDigits) trackOnce("cred_protocol", "crediario_protocol_completed");
    if (field === "installments") track("crediario_installment_selected", { valueCents: totalCents, props: { installments: v.installments } });
    const ok = v.protocol.length === p.crediario.protocolDigits && v.cpfLast3.length === p.crediario.cpfDigits && parseValidity(v.validity, p.crediario.validityFormat);
    if (ok) trackOnce("cred_data", "crediario_data_completed");
  };

  async function lookupCep(raw: string) {
    const cep = onlyDigits(raw);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await res.json();
      if (!j.erro) {
        setForm((f) => ({ ...f, street: j.logradouro || f.street, district: j.bairro || f.district, city: j.localidade || f.city, state: j.uf || f.state }));
        setTimeout(() => document.getElementById(j.logradouro ? "number" : "street")?.focus(), 50);
      } else setErrors((e) => ({ ...e, cep: "CEP não encontrado. Confira ou preencha o endereço." }));
    } catch {
      /* preenchimento manual */
    } finally {
      setCepLoading(false);
    }
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.name.trim().split(/\s+/).length < 2) e.name = "Informe nome e sobrenome";
    if (onlyDigits(form.phone).length < 10) e.phone = "WhatsApp inválido";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "E-mail inválido";
    if (p.requireCpf && onlyDigits(form.cpf).length !== 11) e.cpf = "Informe seu CPF";
    if (onlyDigits(form.cep).length !== 8) e.cep = "CEP inválido";
    if (!form.street.trim()) e.street = "Informe o endereço";
    if (!form.number.trim()) e.number = "Informe o número";
    if (!form.district.trim()) e.district = "Informe o bairro";
    if (!form.city.trim()) e.city = "Informe a cidade";
    if (!form.state) e.state = "Selecione a UF";
    if (!method) e.method = "Escolha a forma de pagamento";
    if (method === "CREDIARIO") for (const [k, v] of Object.entries(validateCrediario(cred, p.crediario))) e[`crediario.${k}`] = v;
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Confira os campos destacados.");
      const first = Object.keys(e)[0];
      const id = first === "method" ? "h-pagamento" : first.startsWith("crediario.") ? { protocol: "cred-protocol", validity: "cred-validity", cpfLast3: "cred-cpf", installments: "cred-protocol" }[first.slice(10)] : first;
      const el = document.getElementById(id ?? first);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setFormError(null);
    setSubmitting(true);
    // Idempotência: repetir o envio do mesmo pedido reaproveita o pedido já criado
    const sig = JSON.stringify([offer.id, method, form.email, method === "CREDIARIO" ? cred.installments : 0]);
    let token = "";
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as { token: string; sig: string } | null;
      if (saved?.sig === sig) token = saved.token;
    } catch {
      /* ignore */
    }
    if (!token) {
      token = randomId(32);
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, sig }));
      } catch {
        /* ignore */
      }
    }
    const paymentEventId = newEventId("addpaymentinfo");
    track("payment_started", { offerId: offer.id, valueCents: totalCents, props: { method } });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutToken: token,
          offerId: offer.id,
          quantity: 1,
          paymentMethod: method,
          customer: { name: form.name, email: form.email, phone: form.phone, cpf: form.cpf || null },
          address: { cep: form.cep, street: form.street, number: form.number, complement: form.complement || null, district: form.district, city: form.city, state: form.state },
          crediario: method === "CREDIARIO" ? cred : null,
          marketingConsent: consent,
          paymentEventId,
          context: getClientContext(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.fields) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.fields as Record<string, string>)) mapped[k.replace(/^(customer|address)\./, "")] = v;
          setErrors(mapped);
        }
        throw new Error(json.error ?? (method === "CREDIARIO" ? p.crediario.errorMessage : "Não conseguimos gerar o PIX agora. Tente novamente."));
      }
      // AddPaymentInfo: sem nenhum dado do crediário (apenas valor e tipo)
      metaEvent("AddPaymentInfo", { value: json.totalCents / 100, currency: "BRL", payment_type: method === "PIX" ? "pix" : "crediario" }, { eventId: paymentEventId });
      gaEvent("add_payment_info", { currency: "BRL", value: json.totalCents / 100, payment_type: method === "PIX" ? "pix" : "crediario" });
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(FORM_KEY);
      } catch {
        /* ignore */
      }
      setCred(EMPTY_CREDIARIO);
      router.push(`/pedido/${json.orderNumber}?t=${json.token}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.");
      setSubmitting(false);
    }
  }

  const inv = (k: string) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});
  const disc = offerDiscountLabel(offer);
  const credErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("crediario.")).map(([k, v]) => [k.slice(10), v]));
  const submitLabel = method === "CREDIARIO" ? p.crediario.buttonLabel : method === "PIX" ? `${p.pix.button} · ${formatBRL(totalCents)}` : "Escolha a forma de pagamento";
  const summary = useMemo(
    () => (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">{offer.name}</span>
          <span className="tabular-nums">{formatBRL(offer.priceCents)}</span>
        </div>
        {offer.compareAtPriceCents && (
          <div className="flex justify-between gap-3 text-success">
            <span>Desconto do kit</span>
            <span className="tabular-nums">− {formatBRL(offer.compareAtPriceCents - offer.priceCents)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-muted">Frete</span>
          <span className={p.shippingCents ? "tabular-nums" : "font-semibold text-success"}>{p.shippingCents ? formatBRL(p.shippingCents) : "Grátis"}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-bold text-navy">Total</span>
          <span className="font-display text-2xl font-bold tabular-nums text-navy">{formatBRL(totalCents)}</span>
        </div>
      </div>
    ),
    [offer, p.shippingCents, totalCents]
  );

  return (
    <form onSubmit={submit} noValidate className="container-page grid gap-5 py-6 sm:py-10 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-[1.75rem] font-bold text-navy sm:text-4xl">{p.title}</h1>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-muted" aria-label="Garantias da compra">
            <li className="flex items-center gap-1"><Icon name="lock" className="h-4 w-4 text-primary" /> Compra segura</li>
            {p.shippingLabel && <li className="flex items-center gap-1"><Icon name="truck" className="h-4 w-4 text-primary" /> {p.shippingLabel}</li>}
          </ul>
        </div>

        {/* Produto e oferta */}
        <section className="card p-4 sm:p-5" aria-labelledby="h-pedido">
          <h2 id="h-pedido" className="text-lg font-bold">Seu pedido</h2>
          <div className="mt-3 flex gap-3">
            {p.imageUrl && <img src={p.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-mist object-contain p-1 mix-blend-multiply" />}
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight text-navy">{p.productName}</p>
              <p className="text-sm text-muted">{offer.quantity} {offer.quantity === 1 ? "frasco" : "frascos"}{p.volume ? ` de ${p.volume}` : ""}</p>
              <p className="mt-1 font-bold tabular-nums text-navy">
                {formatBRL(offer.priceCents)}
                {offer.compareAtPriceCents && <s className="ml-2 text-sm font-medium text-muted">{formatBRL(offer.compareAtPriceCents)}</s>}
                {disc && <span className="ml-2 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">{disc}</span>}
              </p>
            </div>
          </div>
          {p.offers.length > 1 && (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-semibold text-navy">Quantidade</legend>
              <div className="grid grid-cols-3 gap-2">
                {p.offers.map((o) => (
                  <label key={o.id} className={`relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2 text-center ${o.id === offer.id ? "border-primary bg-primary/[0.05]" : "border-line"}`}>
                    <input
                      type="radio"
                      name="offer"
                      className="sr-only"
                      checked={o.id === offer.id}
                      onChange={() => {
                        setOfferId(o.id);
                        track("offer_selected", { productId: p.productId, offerId: o.id, valueCents: o.priceCents, element: "checkout_offer" });
                      }}
                    />
                    <span className="text-sm font-bold text-navy">{o.quantity} un.</span>
                    <span className="text-xs tabular-nums text-muted">{formatBRL(o.priceCents)}</span>
                    {o.highlight && <span className="absolute -top-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{o.badge || "Destaque"}</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="mt-4 border-t border-line pt-4">{summary}</div>
        </section>

        {/* Dados */}
        <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="h-dados">
          <h2 id="h-dados" className="text-lg font-bold">Seus dados</h2>
          <Field id="name" label="Nome completo" error={errors.name}>
            <input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className="input" {...inv("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="WhatsApp" error={errors.phone}>
              <input id="phone" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} autoComplete="tel-national" inputMode="tel" placeholder="(11) 91234-5678" className="input" {...inv("phone")} />
            </Field>
            <Field id="email" label="E-mail" error={errors.email}>
              <input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value.trim())} autoComplete="email" inputMode="email" className="input" {...inv("email")} />
            </Field>
          </div>
          {p.requireCpf && (
            <Field id="cpf" label="CPF" error={errors.cpf}>
              <input id="cpf" value={form.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className="input" {...inv("cpf")} />
            </Field>
          )}
        </section>

        {/* Entrega */}
        <section className="card grid grid-cols-6 gap-4 p-4 sm:p-5" aria-labelledby="h-entrega">
          <h2 id="h-entrega" className="col-span-6 text-lg font-bold">Entrega</h2>
          {p.shippingNote && <p className="col-span-6 -mt-2 text-sm text-muted">{p.shippingNote}</p>}
          <Field id="cep" label={cepLoading ? "CEP (buscando…)" : "CEP"} error={errors.cep} className="col-span-6 sm:col-span-3">
            <input id="cep" value={form.cep} onChange={(e) => { set("cep", maskCep(e.target.value)); if (onlyDigits(e.target.value).length === 8) lookupCep(e.target.value); }} autoComplete="postal-code" inputMode="numeric" placeholder="00000-000" className="input" {...inv("cep")} />
          </Field>
          <Field id="street" label="Endereço" error={errors.street} className="col-span-6">
            <input id="street" value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" className="input" {...inv("street")} />
          </Field>
          <Field id="number" label="Número" error={errors.number} className="col-span-2">
            <input id="number" value={form.number} onChange={(e) => set("number", e.target.value)} inputMode="numeric" className="input" {...inv("number")} />
          </Field>
          <Field id="complement" label="Complemento" className="col-span-4">
            <input id="complement" value={form.complement} onChange={(e) => set("complement", e.target.value)} autoComplete="address-line2" placeholder="Opcional" className="input" />
          </Field>
          <Field id="district" label="Bairro" error={errors.district} className="col-span-6 sm:col-span-3">
            <input id="district" value={form.district} onChange={(e) => set("district", e.target.value)} className="input" {...inv("district")} />
          </Field>
          <Field id="city" label="Cidade" error={errors.city} className="col-span-4 sm:col-span-2">
            <input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" className="input" {...inv("city")} />
          </Field>
          <Field id="state" label="UF" error={errors.state} className="col-span-2 sm:col-span-1">
            <select id="state" value={form.state} onChange={(e) => set("state", e.target.value)} autoComplete="address-level1" className="input px-2" {...inv("state")}>
              <option value="">—</option>
              {UF_LIST.map((uf) => <option key={uf}>{uf}</option>)}
            </select>
          </Field>
        </section>

        {/* Pagamento */}
        <section className="card p-4 sm:p-5" aria-labelledby="h-pagamento">
          <h2 id="h-pagamento" tabIndex={-1} className="text-lg font-bold outline-none">Forma de pagamento</h2>
          {methods.length === 0 && <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm">Os pagamentos estão temporariamente indisponíveis. Tente novamente em alguns minutos.</p>}
          <div className="mt-3 grid gap-3" role="radiogroup" aria-label="Forma de pagamento">
            {p.pix.enabled && (
              <button type="button" role="radio" aria-checked={method === "PIX"} onClick={() => chooseMethod("PIX")} data-cta="method_pix" className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${method === "PIX" ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "border-line hover:border-navy/30"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === "PIX" ? "border-primary" : "border-line"}`}>{method === "PIX" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
                <Icon name="pix" className="h-7 w-7 shrink-0 text-primary" />
                <span>
                  <span className="block font-bold text-navy">{p.pix.label}</span>
                  <span className="block text-sm text-muted">{p.pix.description}</span>
                </span>
              </button>
            )}
            {p.crediario.enabled && (
              <button type="button" role="radio" aria-checked={method === "CREDIARIO"} onClick={() => chooseMethod("CREDIARIO")} data-cta="method_crediario" className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${method === "CREDIARIO" ? "border-primary bg-primary/[0.05] ring-1 ring-primary" : "border-line hover:border-navy/30"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === "CREDIARIO" ? "border-primary" : "border-line"}`}>{method === "CREDIARIO" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
                <Icon name="box" className="h-7 w-7 shrink-0 text-primary" />
                <span>
                  <span className="block font-bold text-navy">{p.crediario.methodLabel}</span>
                  <span className="block text-sm text-muted">{p.crediario.maxInstallments > 1 ? `Em até ${p.crediario.maxInstallments}x · ` : ""}com o protocolo do seu crediário</span>
                </span>
              </button>
            )}
          </div>
          {errors.method && <p className="mt-2 text-sm font-semibold text-danger">{errors.method}</p>}
          {method === "CREDIARIO" && (
            <div className="mt-5 border-t border-line pt-5">
              <CrediarioFields cfg={p.crediario} totalCents={totalCents} value={cred} onChange={onCred} errors={credErrors} />
            </div>
          )}
        </section>

        <label className="flex cursor-pointer items-start gap-3 px-1 text-sm text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{p.consentLabel}</span>
        </label>

        {formError && <p className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger" role="alert">{formError}</p>}

        <div className="lg:hidden">
          <button type="submit" disabled={submitting || !methods.length} data-cta="checkout_submit" className="btn-primary w-full">
            {submitting ? "Processando…" : submitLabel}
          </button>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Icon name="lock" className="h-4 w-4 shrink-0 text-primary" /> {p.securityText}</p>
          <p className="mt-2 text-center text-xs text-muted">
            Ao continuar, você concorda com os <Link href="/termos" className="underline">Termos</Link> e a <Link href="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
          </p>
        </div>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <div className="card p-5">
          <h2 className="text-lg font-bold">Resumo</h2>
          <div className="mt-4">{summary}</div>
          {method === "CREDIARIO" && <p className="mt-3 rounded-lg bg-mist/70 px-3 py-2 text-sm font-semibold text-navy">{p.crediario.methodLabel}: {cred.installments}x</p>}
          <button type="submit" disabled={submitting || !methods.length} data-cta="checkout_submit" className="btn-primary mt-5 w-full">
            {submitting ? "Processando…" : submitLabel}
          </button>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Icon name="lock" className="h-4 w-4 shrink-0 text-primary" /> {p.securityText}</p>
          <p className="mt-3 text-center text-xs text-muted">
            Ao continuar, você concorda com os <Link href="/termos" className="underline">Termos</Link> e a <Link href="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
          </p>
        </div>
      </aside>
    </form>
  );
}
