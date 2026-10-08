"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CrediarioFields, EMPTY_CREDIARIO, type CrediarioValue } from "@/components/checkout/CrediarioFields";
import { Icon } from "@/components/ui/Icon";
import { ProductStack, Stage } from "@/components/ui/ProductStage";
import { gaEvent, getClientContext, metaEvent, newEventId, randomId, track, trackOnce } from "@/lib/client/tracking";
import { parseValidity, validateCrediario, type CrediarioConfig } from "@/lib/crediario";
import { offerDiscountLabel } from "@/lib/pricing";
import { formatBRL } from "@/utils/format";
import { maskCep, maskCpf, maskPhone, onlyDigits, UF_LIST } from "@/utils/validators";
import type { PublicBump, PublicOffer } from "@/types/catalog";

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
  bumps: PublicBump[];
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

function StepTitle({ n, title, id, done }: { n: number; title: string; id: string; done?: boolean }) {
  return (
    <h2 id={id} tabIndex={-1} className="flex items-center gap-3 text-lg font-semibold text-navy outline-none">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${done ? "bg-success text-white" : "bg-navy text-white"}`}>
        {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : n}
      </span>
      {title}
    </h2>
  );
}

export function CheckoutClient(p: CheckoutProps) {
  const router = useRouter();
  const [offerId, setOfferId] = useState(p.initialOfferId);
  const offer = p.offers.find((o) => o.id === offerId) ?? p.offers[0];
  const [bumpIds, setBumpIds] = useState<string[]>([]);
  const chosenBumps = p.bumps.filter((b) => bumpIds.includes(b.id));
  const totalCents = offer.priceCents + chosenBumps.reduce((s, b) => s + b.priceCents, 0) + p.shippingCents;
  const savings = (offer.compareAtPriceCents ? offer.compareAtPriceCents - offer.priceCents : 0) + chosenBumps.reduce((s, b) => s + (b.compareAtPriceCents ? b.compareAtPriceCents - b.priceCents : 0), 0);
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
    p.bumps.forEach((b) => trackOnce(`bump:${b.id}`, "order_bump_view", { productId: p.productId, valueCents: b.priceCents, element: `bump_${b.id}`, props: { bumpId: b.id } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _a, ...rest }) => rest);
  };

  const toggleBump = (b: PublicBump) => {
    const on = !bumpIds.includes(b.id);
    setBumpIds((ids) => (on ? [...ids, b.id] : ids.filter((x) => x !== b.id)));
    track(on ? "order_bump_accept" : "order_bump_reject", { productId: p.productId, valueCents: b.priceCents, element: `bump_${b.id}`, props: { bumpId: b.id } });
  };

  const chooseMethod = (m: "PIX" | "CREDIARIO") => {
    setMethod(m);
    setFormError(null);
    setErrors(({ method: _m, ...rest }) => rest);
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
    const sig = JSON.stringify([offer.id, [...bumpIds].sort(), method, form.email, method === "CREDIARIO" ? cred.installments : 0]);
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
          bumpIds,
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
  const submitLabel = method === "CREDIARIO" ? p.crediario.buttonLabel : method === "PIX" ? p.pix.button : "Escolher pagamento";
  const dataDone = form.name.trim().split(/\s+/).length >= 2 && onlyDigits(form.phone).length >= 10 && /^\S+@\S+\.\S+$/.test(form.email.trim()) && (!p.requireCpf || onlyDigits(form.cpf).length === 11);
  const addrDone = onlyDigits(form.cep).length === 8 && Boolean(form.street && form.number && form.district && form.city && form.state);

  const summary = useMemo(
    () => (
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">{offer.name}</span>
          <span className="tabular-nums text-ink">{formatBRL(offer.priceCents)}</span>
        </div>
        {chosenBumps.map((b) => (
          <div key={b.id} className="flex justify-between gap-3">
            <span className="text-muted">+ {b.title}</span>
            <span className="tabular-nums text-ink">{formatBRL(b.priceCents)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <span className="text-muted">Frete</span>
          <span className={p.shippingCents ? "tabular-nums" : "font-semibold text-success"}>{p.shippingCents ? formatBRL(p.shippingCents) : "Grátis"}</span>
        </div>
        {savings > 0 && (
          <div className="flex justify-between gap-3 font-semibold text-success">
            <span>Você economiza</span>
            <span className="tabular-nums">{formatBRL(savings)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="font-semibold text-navy">Total</span>
          <span className="font-display text-[1.75rem] font-semibold tabular-nums tracking-tight text-navy">{formatBRL(totalCents)}</span>
        </div>
        {method === "CREDIARIO" && <p className="rounded-lg bg-mist/70 px-3 py-2 text-[13px] font-semibold text-navy">{p.crediario.methodLabel} em {cred.installments}x</p>}
      </div>
    ),
    [offer, chosenBumps, p.shippingCents, savings, totalCents, method, cred.installments, p.crediario.methodLabel]
  );

  const legal = (
    <p className="mt-3 text-center text-xs text-muted">
      Ao continuar, você concorda com os <Link href="/termos" className="underline">Termos</Link> e a <Link href="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
    </p>
  );

  return (
    <form id="checkout-form" onSubmit={submit} noValidate className="container-page grid gap-5 pb-32 pt-5 sm:pt-8 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-10 lg:pb-16">
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-[1.7rem] font-semibold tracking-tight text-navy sm:text-4xl">{p.title}</h1>
          <ol className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-muted" aria-label="Etapas">
            {["Seus dados", "Entrega", "Pagamento"].map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 ${(i === 0 && dataDone) || (i === 1 && addrDone) || (i === 2 && method) ? "bg-success/10 text-success" : "bg-surface ring-1 ring-line"}`}>{t}</span>
                {i < 2 && <span aria-hidden="true" className="h-px w-3 bg-line" />}
              </li>
            ))}
          </ol>
        </div>

        {/* Produto e kit */}
        <section className="card overflow-hidden" aria-labelledby="h-pedido">
          <div className="grid items-center gap-2 bg-gradient-to-b from-mist to-surface px-4 pt-4 sm:grid-cols-[200px_1fr] sm:gap-5 sm:p-5">
            {p.imageUrl && (
              <Stage className="mx-auto aspect-[1/0.85] w-full max-w-[15rem] sm:max-w-none">
                <ProductStack src={p.imageUrl} alt={p.productName} count={offer.quantity} className="absolute inset-x-0 bottom-[6%] top-[4%]" priority />
              </Stage>
            )}
            <div className="pb-4 sm:pb-0">
              <p id="h-pedido" className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Seu pedido</p>
              <p className="mt-1 font-display text-xl font-semibold text-navy">{p.productName} — {offer.name}</p>
              <p className="text-sm text-muted">{offer.quantity} {offer.quantity === 1 ? "frasco" : "frascos"}{p.volume ? ` de ${p.volume}` : ""}</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-2xl font-semibold tabular-nums text-navy">{formatBRL(offer.priceCents)}</span>
                {offer.compareAtPriceCents && <s className="text-sm text-muted">{formatBRL(offer.compareAtPriceCents)}</s>}
                {disc && <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">{disc}</span>}
              </p>
            </div>
          </div>
          {p.offers.length > 1 && (
            <fieldset className="border-t border-line p-4 sm:p-5">
              <legend className="sr-only">Escolha o kit</legend>
              <p className="mb-3 text-sm font-semibold text-navy">Quantas unidades?</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {p.offers.map((o) => {
                  const on = o.id === offer.id;
                  return (
                    <label key={o.id} className={`relative flex cursor-pointer flex-col items-center rounded-xl border-2 px-1.5 pb-2.5 pt-3 text-center transition ${on ? "border-primary bg-primary/[0.04]" : "border-line bg-surface"}`}>
                      <input
                        type="radio"
                        name="offer"
                        className="sr-only"
                        checked={on}
                        onChange={() => {
                          setOfferId(o.id);
                          track("offer_selected", { productId: p.productId, offerId: o.id, valueCents: o.priceCents, element: "checkout_offer" });
                        }}
                      />
                      {o.badge && <span className={`absolute -top-2.5 whitespace-nowrap rounded-full px-2 text-[10px] font-bold leading-5 text-white ${o.highlight ? "bg-primary" : "bg-navy"}`}>{o.badge.length > 14 ? (o.highlight ? "Destaque" : "Mais econômico") : o.badge}</span>}
                      {p.imageUrl && <ProductStack src={p.imageUrl} alt="" count={o.quantity} className="h-16 w-full" />}
                      <span className="mt-1.5 text-sm font-bold text-navy">{o.quantity} {o.quantity === 1 ? "unidade" : "unidades"}</span>
                      <span className="text-[13px] font-semibold tabular-nums text-ink">{formatBRL(o.priceCents)}</span>
                      {o.quantity > 1 && <span className="text-[11px] text-muted">{formatBRL(o.unitPriceCents)}/un.</span>}
                      {on && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><Icon name="check" className="h-3 w-3" strokeWidth={3} /></span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </section>

        {/* Dados */}
        <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="h-dados">
          <StepTitle n={1} title="Seus dados" id="h-dados" done={dataDone} />
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
        <section className="card grid grid-cols-6 gap-4 p-4 sm:p-6" aria-labelledby="h-entrega">
          <div className="col-span-6 flex flex-wrap items-center justify-between gap-2">
            <StepTitle n={2} title="Entrega" id="h-entrega" done={addrDone} />
            {p.shippingCents === 0 && <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">Frete grátis</span>}
          </div>
          {p.shippingNote && <p className="col-span-6 -mt-1 text-sm text-muted">{p.shippingNote}</p>}
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

        {/* Order bumps — opcionais, desmarcados por padrão */}
        {p.bumps.length > 0 && (
          <section className="space-y-3" aria-labelledby="h-extras">
            <div className="px-1">
              <h2 id="h-extras" className="text-lg font-semibold text-navy">Aproveite e leve junto</h2>
              <p className="text-sm text-muted">Ofertas exclusivas deste pedido. Marque se quiser adicionar.</p>
            </div>
            {p.bumps.map((b) => {
              const on = bumpIds.includes(b.id);
              return (
                <button
                  type="button"
                  key={b.id}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleBump(b)}
                  data-cta={`order_bump_${b.id}`}
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 p-3 text-left transition sm:gap-4 sm:p-4 ${on ? "border-success bg-success/[0.05] shadow-soft" : "border-dashed border-primary/45 bg-surface hover:border-primary"}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? "border-success bg-success text-white" : "border-primary/60 bg-surface"}`}>
                    {on && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  {b.imageUrl && (
                    <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl bg-gradient-to-b from-mist to-surface sm:h-20 sm:w-20">
                      <ProductStack src={b.imageUrl} alt="" count={b.quantity} className="absolute inset-1" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {b.badge && <span className="mb-1 inline-block rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{b.badge}</span>}
                    <span className="block font-semibold leading-snug text-navy">{b.title}</span>
                    {b.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{b.description}</span>}
                    <span className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-bold tabular-nums text-primary">+ {formatBRL(b.priceCents)}</span>
                      {b.compareAtPriceCents && <s className="text-xs text-muted">{formatBRL(b.compareAtPriceCents)}</s>}
                    </span>
                    {on && <span className="mt-1 block text-[13px] font-bold text-success">Adicionado ao pedido</span>}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {/* Pagamento */}
        <section className="card p-4 sm:p-6" aria-labelledby="h-pagamento">
          <StepTitle n={3} title="Forma de pagamento" id="h-pagamento" done={Boolean(method)} />
          {methods.length === 0 && <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm">Os pagamentos estão temporariamente indisponíveis. Tente novamente em alguns minutos.</p>}
          <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Forma de pagamento">
            {p.pix.enabled && (
              <button type="button" role="radio" aria-checked={method === "PIX"} onClick={() => chooseMethod("PIX")} data-cta="method_pix" className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${method === "PIX" ? "border-primary bg-primary/[0.04]" : "border-line hover:border-navy/25"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === "PIX" ? "border-primary" : "border-line"}`}>{method === "PIX" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#32BCAD]/10 text-[#1a9e91]"><Icon name="pix" className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-navy">{p.pix.label}<span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">aprovação imediata</span></span>
                  <span className="block text-[13px] text-muted">{p.pix.description}</span>
                </span>
              </button>
            )}
            {p.crediario.enabled && (
              <button type="button" role="radio" aria-checked={method === "CREDIARIO"} onClick={() => chooseMethod("CREDIARIO")} data-cta="method_crediario" className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${method === "CREDIARIO" ? "border-primary bg-primary/[0.04]" : "border-line hover:border-navy/25"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === "CREDIARIO" ? "border-primary" : "border-line"}`}>{method === "CREDIARIO" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon name="box" className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-navy">{p.crediario.methodLabel}</span>
                  <span className="block text-[13px] text-muted">{p.crediario.maxInstallments > 1 ? `Em até ${p.crediario.maxInstallments}x · ` : ""}com o protocolo do seu crediário</span>
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

        {/* Resumo (celular) */}
        <section className="card p-4 sm:p-6 lg:hidden" aria-label="Resumo do pedido">
          <h2 className="mb-3 text-lg font-semibold text-navy">Resumo</h2>
          {summary}
        </section>

        <label className="flex cursor-pointer items-start gap-3 px-1 text-sm text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{p.consentLabel}</span>
        </label>

        {formError && <p className="rounded-xl bg-danger/10 px-4 py-3 font-semibold text-danger" role="alert">{formError}</p>}

        <div className="lg:hidden">
          <button type="submit" disabled={submitting || !methods.length} data-cta="checkout_submit" className="btn-primary w-full">
            {submitting ? "Processando…" : `${submitLabel} · ${formatBRL(totalCents)}`}
          </button>
          {legal}
        </div>

        <ul className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold leading-tight text-navy/80">
          {[
            ["lock", "Compra segura"],
            ["shield", "Dados protegidos"],
            ["truck", p.shippingLabel || "Entrega com acompanhamento"],
          ].map(([i, t]) => (
            <li key={t} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface p-3 ring-1 ring-line">
              <Icon name={i} className="h-5 w-5 text-primary" />
              {t}
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 px-1 text-xs text-muted"><Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p.securityText}</p>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <div className="card overflow-hidden">
          {p.imageUrl && (
            <div className="bg-gradient-to-b from-mist to-surface px-6 pt-6">
              <Stage className="mx-auto aspect-[1/0.8] w-full max-w-[16rem]">
                <ProductStack src={p.imageUrl} alt="" count={offer.quantity} className="absolute inset-x-0 bottom-[6%] top-[4%]" />
              </Stage>
            </div>
          )}
          <div className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-navy">Resumo do pedido</h2>
            {summary}
            <button type="submit" disabled={submitting || !methods.length} data-cta="checkout_submit" className="btn-primary mt-5 w-full">
              {submitting ? "Processando…" : submitLabel}
            </button>
            {legal}
          </div>
        </div>
      </aside>

      {/* Barra fixa no celular: total + botão */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-page items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total</p>
            <p className="font-display text-xl font-semibold tabular-nums leading-tight text-navy">{formatBRL(totalCents)}</p>
          </div>
          <button type="submit" disabled={submitting || !methods.length} data-cta="checkout_submit_sticky" className="btn-primary min-h-[48px] flex-1 px-4 text-[14px]">
            {submitting ? "Processando…" : method ? submitLabel : "Finalizar pedido"}
          </button>
        </div>
      </div>
    </form>
  );
}
