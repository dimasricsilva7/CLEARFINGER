import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPixBody, signWebhookPayload, statusFromEvent, verifyWebhookSignature, type BravopayWebhookEvent } from "../src/lib/payments/bravopay";
import { crediarioConfig, installmentOptions, maskValidity, parseValidity, validateCrediario } from "../src/lib/crediario";
import { SETTING_DEFAULTS } from "../src/lib/settings-defaults";
import { canTransition } from "../src/lib/order-status";
import { computeTotals, discountPct, offerDiscountLabel } from "../src/lib/pricing";
import { classifyChannel } from "../src/utils/channel";
import { isValidCpf } from "../src/utils/validators";

const cfg = crediarioConfig(SETTING_DEFAULTS);
const now = new Date("2026-10-07T12:00:00Z");

test("crediário: configuração padrão (16 dígitos, MM/AA, 3 dígitos do CPF, até 2x)", () => {
  assert.equal(cfg.protocolDigits, 16);
  assert.equal(cfg.validityFormat, "MM/AA");
  assert.equal(cfg.cpfDigits, 3);
  assert.equal(cfg.maxInstallments, 2);
  assert.equal(cfg.methodLabel, "Crediário");
  assert.match(cfg.protocolError, /16 dígitos/);
});

test("crediário: textos e regras vêm das configurações", () => {
  const c = crediarioConfig({ ...SETTING_DEFAULTS, crediario_method_label: "Pagamento por Protocolo", crediario_protocol_label: "Código do seu crediário", crediario_protocol_digits: "12", crediario_max_installments: "4" });
  assert.equal(c.methodLabel, "Pagamento por Protocolo");
  assert.equal(c.protocolLabel, "Código do seu crediário");
  assert.equal(c.protocolDigits, 12);
  assert.equal(installmentOptions(10000, c).length, 4);
});

test("crediário: validação de protocolo, validade, CPF e parcelas", () => {
  const good = { protocol: "1234567812345678", validity: "12/30", cpfLast3: "725", installments: 2 };
  assert.deepEqual(validateCrediario(good, cfg, now), {});
  const bad = validateCrediario({ protocol: "123", validity: "13/30", cpfLast3: "7a5", installments: 3 }, cfg, now);
  assert.ok(bad.protocol && bad.validity && bad.cpfLast3 && bad.installments);
  assert.ok(validateCrediario({ ...good, protocol: "12345678123456789" }, cfg, now).protocol, "17 dígitos é inválido");
  assert.equal(validateCrediario({ ...good, validity: "01/20" }, cfg, now).validity, cfg.validityExpiredError);
  const lenient = crediarioConfig({ ...SETTING_DEFAULTS, crediario_validity_reject_expired: "false" });
  assert.deepEqual(validateCrediario({ ...good, validity: "01/20" }, lenient, now), {});
});

test("crediário: formatos de validade e máscara", () => {
  assert.equal(maskValidity("1230", "MM/AA"), "12/30");
  assert.equal(maskValidity("12/2030", "MM/AAAA"), "12/2030");
  assert.equal(maskValidity("31122030", "DD/MM/AAAA"), "31/12/2030");
  assert.ok(parseValidity("02/30", "MM/AA"));
  assert.equal(parseValidity("02/30", "MM/AA")!.toISOString().slice(0, 10), "2030-02-28");
  assert.equal(parseValidity("31/02/2030", "DD/MM/AAAA"), null);
  assert.equal(parseValidity("12/30", "MM/AAAA"), null);
});

test("crediário: parcelas nunca somam menos que o total", () => {
  const opts = installmentOptions(5990, cfg);
  assert.deepEqual(opts.map((o) => o.label), ["1x de R$ 59,90", "2x de R$ 29,95"]);
  const odd = installmentOptions(9999, { ...cfg, maxInstallments: 3 });
  assert.ok(odd.every((o) => o.cents * o.n >= 9999));
});

test("webhook: assinatura HMAC válida, inválida, antiga", () => {
  const body = JSON.stringify({ id: "evt_1", type: "transaction.paid", data: {} });
  const secret = "whsec_test";
  const now = Date.now();
  const header = signWebhookPayload(body, secret, Math.floor(now / 1000));
  assert.equal(verifyWebhookSignature(body, header, secret, 300, now), true);
  assert.equal(verifyWebhookSignature(body + " ", header, secret, 300, now), false);
  assert.equal(verifyWebhookSignature(body, header, "outro", 300, now), false);
  assert.equal(verifyWebhookSignature(body, signWebhookPayload(body, secret, Math.floor(now / 1000) - 3600), secret, 300, now), false);
  assert.equal(verifyWebhookSignature(body, null, secret), false);
});

test("webhook: tipo do evento prevalece sobre o status", () => {
  const ev = (type: string): BravopayWebhookEvent => ({ id: "e", type, created: 0, data: { id: "t", status: "PENDING", amount_cents: 100 } });
  assert.equal(statusFromEvent(ev("transaction.paid")), "PAID");
  assert.equal(statusFromEvent(ev("transaction.expired")), "EXPIRED");
  assert.equal(statusFromEvent(ev("transaction.refunded")), "REFUNDED");
});

test("PIX: corpo da cobrança segue o contrato da BravoPay", () => {
  const body = buildPixBody({ amountCents: 9990, idempotencyKey: "k", externalReference: "CF12345-2026", description: "x".repeat(400), customer: { name: "A B", email: "a@b.c", cpf: "529.982.247-25", phone: "(11) 91234-5678" }, utm: { source: "facebook", campaign: "c" }, expiresInSeconds: 10 });
  assert.equal(body.method, "pix");
  assert.equal(body.description.length, 300);
  assert.equal(body.expires_in, 60);
  assert.equal(body.customer.cpf, "52998224725");
  assert.deepEqual(body.utm, { source: "facebook", campaign: "c" });
});

test("status: transições do PIX e crediário isolado do gateway", () => {
  assert.equal(canTransition("PIX_GENERATED", "PAID"), true);
  assert.equal(canTransition("EXPIRED", "PAID"), true);
  assert.equal(canTransition("PAID", "EXPIRED"), false);
  assert.equal(canTransition("PAID", "REFUNDED"), true);
  assert.equal(canTransition("CREDIARIO_PENDENTE", "PAID"), false);
});

test("preços: totais e desconto real", () => {
  assert.deepEqual(computeTotals([{ unitPriceCents: 9990, quantity: 1 }], 0), { subtotalCents: 9990, discountCents: 0, shippingCents: 0, totalCents: 9990 });
  assert.equal(discountPct(9990, 11980), 17);
  assert.equal(discountPct(9990, 9990), null);
  assert.equal(offerDiscountLabel({ priceCents: 9990, compareAtPriceCents: 11980, discountLabel: "" }), "-17%");
  assert.equal(offerDiscountLabel({ priceCents: 9990, compareAtPriceCents: 11980, discountLabel: "Leve 2" }), "Leve 2");
});

test("utilitários: canal e CPF", () => {
  assert.equal(classifyChannel({ source: "facebook" }), "facebook");
  assert.equal(classifyChannel({ gclid: "x" }), "google");
  assert.equal(classifyChannel({}), "direto");
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
});
