/**
 * Teste ponta a ponta (rodar contra o ambiente local em BRAVOPAY_MODE=mock — NUNCA em produção):
 *   npx tsx scripts/e2e-funnel.ts http://localhost:3000
 * Cobre: landing → oferta → checkout → PIX → webhook assinado → pago → Purchase;
 *        landing → checkout → crediário → pedido pendente → aprovação no admin;
 *        edição no admin (textos do crediário, preço, headline) refletindo no site sem deploy;
 *        webhook com assinatura inválida/duplicado; todas as páginas do admin.
 */
import "dotenv/config";
import fs from "fs";
import crypto from "crypto";
import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE = process.argv[2] ?? "http://localhost:3000";
const PASSWORD = fs.readFileSync(".admin-dev-password", "utf8").trim();
const EMAIL = process.env.ADMIN_EMAIL!;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

async function fillCustomer(page: Page, tag: string) {
  await page.fill("#name", "Cliente Teste E2E");
  await page.fill("#phone", "11912345678");
  await page.fill("#email", `e2e+${tag}@example.com`);
  if (await page.locator("#cpf").count()) await page.fill("#cpf", "52998224725");
  await page.fill("#cep", "01310100");
  await page.waitForTimeout(1200);
  await page.fill("#street", "Avenida Paulista");
  await page.fill("#number", "1000");
  await page.fill("#district", "Bela Vista");
  await page.fill("#city", "São Paulo");
  await page.selectOption("#state", "SP");
}

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL(`${BASE}/admin`, { timeout: 120000 }), page.getByRole("button", { name: "Entrar" }).click()]);
}

async function saveSettingsForm(page: Page, values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) await page.fill(`[name="${k}"]`, v);
  await page.getByRole("button", { name: /Salvar crediário/ }).click();
  await page.getByText(/configuração\(ões\) salva|Nada foi alterado/).waitFor({ timeout: 60000 });
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // ── 1. Landing com UTMs ──
  await page.goto(`${BASE}/?utm_source=facebook&utm_medium=cpc&utm_campaign=e2e_campanha&utm_content=anuncio1&utm_term=conjunto1&fbclid=e2efbclid`);
  ok(await page.locator("h1").isVisible(), "landing: headline visível");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 0, `landing: sem scroll horizontal em 390px (${overflow})`);
  await page.getByRole("button", { name: "Aceitar" }).click().catch(() => {});

  // ── 2. Oferta → checkout PIX ──
  await page.locator("#ofertas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await Promise.all([page.waitForURL(/\/checkout\?oferta=kit-2/), page.locator('[data-cta="offer_kit-2"]').click()]);
  await fillCustomer(page, `pix${Date.now()}`);
  await page.locator('[data-cta^="order_bump_"]').first().click();
  await page.locator('[data-cta="method_pix"]').click();
  await Promise.all([page.waitForURL(/\/pedido\//, { timeout: 90000 }), page.locator('[data-cta="checkout_submit"]').first().click()]);
  const pixUrl = page.url();
  ok(await page.locator('[data-cta="pix_copy"]').isVisible(), "PIX: página do pedido com código");
  ok((await page.content()).includes("Adicione +1 frasco") && (await page.content()).includes("99,80"), "order bump: incluído no pedido e no total (R$ 99,80)");
  await page.getByRole("button", { name: /Mostrar QR Code/ }).click();
  ok(await page.locator('[aria-label="QR Code do PIX"]').isVisible(), "PIX: QR Code exibido");
  await page.locator('[data-cta="pix_copy"]').click();
  const pixOrder = decodeURIComponent(pixUrl.split("/pedido/")[1].split("?")[0]);

  // ── 3. Crediário pelo checkout ──
  await page.goto(`${BASE}/checkout?oferta=kit-1`);
  await fillCustomer(page, `cred${Date.now()}`);
  await page.locator('[data-cta="method_crediario"]').click();
  await page.locator('[data-cta="checkout_submit"]').first().click();
  ok(await page.getByText(/dígitos do protocolo/).first().isVisible(), "crediário: validação dos campos no navegador");
  await page.fill("#cred-protocol", "1234 5678 1234 5678");
  await page.fill("#cred-validity", "1230");
  ok((await page.inputValue("#cred-validity")) === "12/30", "crediário: máscara da validade MM/AA");
  await page.fill("#cred-cpf", "725");
  await page.getByText(/2x de R\$ 19,95/).click();
  await Promise.all([page.waitForURL(/\/pedido\//, { timeout: 90000 }), page.locator('[data-cta="checkout_submit"]').first().click()]);
  ok(await page.getByText("Pedido recebido!").isVisible(), "crediário: confirmação com texto do admin");
  ok(!(await page.content()).includes("1234567812345678"), "crediário: protocolo não aparece na página do cliente");
  ok(!page.url().includes("1234"), "crediário: protocolo não vai para a URL");
  const credOrder = decodeURIComponent(page.url().split("/pedido/")[1].split("?")[0]);

  // ── 4. Webhook: assinatura inválida e duplicado ──
  const body = JSON.stringify({ id: "evt_e2e_invalid", type: "transaction.paid", created: Math.floor(Date.now() / 1000), data: { id: "x", status: "PAID", amount_cents: 1 } });
  const bad = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", body, headers: { "bravopay-signature": "t=1,v1=abc" } });
  ok(bad.status === 401, `webhook: assinatura inválida rejeitada (${bad.status})`);

  // ── 5. Admin ──
  const admin = await ctx.newPage();
  admin.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
  await adminLogin(admin);
  ok(admin.url().endsWith("/admin"), "admin: login");

  // PIX: simula webhook assinado (mesmo caminho de produção)
  await admin.goto(`${BASE}/admin/pedidos?q=${pixOrder}`);
  await Promise.all([admin.waitForURL(/\/admin\/pedidos\/c/, { timeout: 90000 }), admin.getByRole("link", { name: pixOrder }).click()]);
  await admin.getByRole("button", { name: "Simular pagamento (teste)" }).click();
  await admin.getByRole("button", { name: "Confirmar" }).click();
  await admin.getByText("Webhook simulado processado.").or(admin.getByText("Confirmado em")).first().waitFor({ timeout: 60000 });
  await admin.waitForTimeout(12000);
  await admin.reload();
  const html = await admin.content();
  ok(html.includes("PAID") && html.includes("PIX_GENERATED → PAID (webhook)"), "PIX: pedido pago após webhook (linha do tempo)");
  ok(html.includes("e2e_campanha") && html.includes("conjunto1") && html.includes("anuncio1"), "PIX: UTMs, conjunto e anúncio gravados no pedido");

  // Webhook duplicado é idempotente
  const secret = process.env.BRAVOPAY_WEBHOOK_SECRET!;
  const dupBody = JSON.stringify({ id: "evt_e2e_dup_" + Date.now(), type: "transaction.paid", created: Math.floor(Date.now() / 1000), data: { id: "nope", status: "PAID", amount_cents: 100, external_reference: "nao-existe" } });
  const t = Math.floor(Date.now() / 1000);
  const sig = `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${dupBody}`).digest("hex")}`;
  const r1 = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", body: dupBody, headers: { "bravopay-signature": sig } });
  const r2 = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", body: dupBody, headers: { "bravopay-signature": sig } });
  ok(r1.status === 200 && (await r2.json()).duplicate === true, "webhook: duplicado não é reprocessado");

  // Página do cliente mostra confirmação
  await page.goto(pixUrl);
  ok(await page.getByRole("heading", { name: /Pagamento confirmado/ }).isVisible(), "PIX: cliente vê pagamento confirmado (Purchase)");

  // ── Rastreio do pedido (linha do tempo automática + consulta pública) ──
  await page.goto(pixUrl);
  ok(await page.getByRole("heading", { name: "Acompanhe sua entrega" }).isVisible(), "pedido pago: linha do tempo de entrega na página do pedido");
  ok(await page.getByText("Pagamento concluído").first().isVisible(), "linha do tempo: etapa 1 (Pagamento concluído) gerada na confirmação");
  const lookup = (b: Record<string, string>) => fetch(`${BASE}/api/rastrear`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify(b) });
  const okCpf = await lookup({ orderNumber: pixOrder.toLowerCase(), cpf: "529.982.247-25" });
  const okCpfJson = await okCpf.json();
  ok(okCpf.status === 200 && okCpfJson.events?.[0]?.status === "PAID" && okCpfJson.etaText?.includes("3 a 5 dias úteis"), "rastreio: pedido + CPF encontra o pedido (etapa 1 + prazo)");
  ok(!JSON.stringify(okCpfJson).includes("52998224725") && !JSON.stringify(okCpfJson).includes("@example.com"), "rastreio: resposta sem CPF/e-mail");
  const okMail = await lookup({ orderNumber: pixOrder, email: "nao@usado.com" });
  ok(okMail.status === 404, "rastreio: e-mail errado → não encontrado");
  const badCpf = await lookup({ orderNumber: pixOrder, cpf: "11144477735" });
  const badCpfJson = await badCpf.json();
  const noOrder = await lookup({ orderNumber: "CF00000-2026", cpf: "52998224725" });
  const noOrderJson = await noOrder.json();
  ok(badCpf.status === 404 && noOrder.status === 404 && badCpfJson.error === noOrderJson.error, "rastreio: CPF errado e pedido inexistente têm a mesma resposta genérica");
  await page.goto(`${BASE}/rastrear-pedido?pedido=${pixOrder}`);
  await page.fill("#cpf", "52998224725");
  await page.getByRole("button", { name: "Rastrear pedido" }).click();
  await page.getByText("Linha do tempo").waitFor({ timeout: 30000 });
  ok(await page.getByText("Entrega estimada em 3 a 5 dias úteis").isVisible(), "rastreio (página): resultado com prazo e linha do tempo");
  ok(await page.getByText("Pedido saiu para entrega").isVisible(), "rastreio (página): próximas etapas listadas");

  // Admin: marcar como entregue (manual) → aparece no rastreio
  await admin.goto(`${BASE}/admin/pedidos?q=${pixOrder}`);
  await Promise.all([admin.waitForURL(/\/admin\/pedidos\/c/, { timeout: 90000 }), admin.getByRole("link", { name: pixOrder }).click()]);
  ok(await admin.getByText("Rastreio da entrega (visto pelo cliente)").isVisible(), "admin: linha do tempo de entrega no pedido");
  ok(await admin.getByText("automático").first().isVisible(), "admin: etapa marcada como automática");
  await admin.getByRole("button", { name: "Marcar como entregue" }).click();
  await admin.getByText("Pedido entregue").first().waitFor({ timeout: 60000 });
  const delivered = await (await fetch(`${BASE}/api/rastrear`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ orderNumber: pixOrder, cpf: "52998224725" }) })).json();
  ok(delivered.delivered === true && delivered.statusLabel === "Entregue", "rastreio: 'Entregue' manual refletido para o cliente");

  // Upsell: ativa (produto + oferta) e aceita na página do pedido pago
  const odor = await prisma.product.findUnique({ where: { slug: "clearfinger-odor-control" } });
  const ups = odor ? await prisma.upsell.findFirst({ where: { productId: odor.id } }) : null;
  if (odor && ups) {
    await prisma.product.update({ where: { id: odor.id }, data: { active: true } });
    await prisma.upsell.update({ where: { id: ups.id }, data: { active: true, priceCents: 2990 } });
    await prisma.upsellEvent.deleteMany({ where: { upsellId: ups.id } });
    await page.goto(pixUrl);
    await page.locator("[data-testid=upsell]").waitFor({ timeout: 30000 });
    ok(await page.getByText("Leve também o CLEARFINGER ODOR CONTROL").isVisible(), "upsell: exibido após o pagamento");
    await Promise.all([page.waitForURL((u) => !u.toString().includes(pixOrder) && u.toString().includes("/pedido/"), { timeout: 90000 }), page.locator('[data-cta="upsell_accept"]').click()]);
    ok(await page.locator('[data-cta="pix_copy"]').isVisible() && (await page.content()).includes("29,90"), "upsell: aceite gera novo pedido PIX (R$ 29,90)");
    const parent = await prisma.order.findUnique({ where: { orderNumber: pixOrder }, include: { childOrders: true } });
    ok(parent?.status === "PAID" && parent.childOrders.length === 1 && parent.childOrders[0].source === "UPSELL", "upsell: pedido original intacto e vinculado ao novo");
    await page.goto(pixUrl);
    ok((await page.locator("[data-testid=upsell]").count()) === 0, "upsell: não aparece de novo depois de aceito");
    await prisma.upsell.update({ where: { id: ups.id }, data: { active: false } });
    await prisma.product.update({ where: { id: odor.id }, data: { active: false } });
  } else ok(false, "upsell: produto/oferta ODOR CONTROL não encontrados (rode prisma/update-2026-10-08b.ts)");

  // Crediário: dados mascarados + aprovação
  await admin.goto(`${BASE}/admin/pedidos?metodo=CREDIARIO&q=${credOrder}`);
  await Promise.all([admin.waitForURL(/\/admin\/pedidos\/c/, { timeout: 90000 }), admin.getByRole("link", { name: credOrder }).click()]);
  await admin.getByText("***725").waitFor({ timeout: 60000 });
  ok(await admin.getByText("***725").isVisible(), "crediário: CPF mascarado (***725)");
  ok(await admin.getByText("•••• •••• •••• 5678").isVisible(), "crediário: protocolo mascarado por padrão");
  await admin.getByRole("button", { name: "Ver protocolo completo e validade" }).click();
  await admin.getByText(/Protocolo: 1234/).waitFor({ timeout: 60000 });
  ok(await admin.getByText("Protocolo: 1234 5678 1234 5678 · Validade: 12/30").isVisible(), "crediário: admin autorizado vê o protocolo completo");
  await admin.selectOption('select[name="status"]', "CREDIARIO_APROVADO");
  await admin.getByRole("button", { name: "Atualizar status do crediário" }).click();
  await admin.getByText(/Status alterado para Crediário aprovado|Aprovado em/).first().waitFor({ timeout: 60000 });
  ok(true, "crediário: aprovado no admin");

  // Textos do crediário editáveis (sem deploy)
  await admin.goto(`${BASE}/admin/pagamentos/crediario`);
  await saveSettingsForm(admin, { crediario_method_label: "Pagamento por Protocolo", crediario_protocol_label: "Código do seu crediário", crediario_protocol_placeholder: "Digite o código" });
  await page.goto(`${BASE}/checkout?oferta=kit-1`);
  await page.locator('[data-cta="method_crediario"]').click();
  ok(await page.getByText("Pagamento por Protocolo").first().isVisible(), "admin → checkout: nome do método atualizado");
  ok(await page.getByText("Código do seu crediário").isVisible(), "admin → checkout: título do protocolo atualizado");
  ok((await page.getAttribute("#cred-protocol", "placeholder")) === "Digite o código", "admin → checkout: placeholder atualizado");
  await admin.goto(`${BASE}/admin/pagamentos/crediario`);
  await saveSettingsForm(admin, { crediario_method_label: "Crediário", crediario_protocol_label: "Número do protocolo", crediario_protocol_placeholder: "Digite os 16 dígitos do seu protocolo" });

  // Preço da oferta editável
  await admin.goto(`${BASE}/admin/ofertas`);
  const form = admin.locator("form", { has: admin.locator('input[name="slug"][value="kit-1"]') });
  await form.locator('input[name="price"]').fill("37,90");
  await form.getByRole("button", { name: "Salvar oferta" }).click();
  await admin.getByText(/Oferta salva/).first().waitFor({ timeout: 60000 });
  await page.goto(BASE);
  ok((await page.content()).includes("37,90"), "admin → landing: preço atualizado sem deploy");
  await form.locator('input[name="price"]').fill("39,90");
  await form.getByRole("button", { name: "Salvar oferta" }).click();
  await admin.getByText(/Oferta salva/).first().waitFor({ timeout: 60000 });

  // Todas as páginas do admin
  for (const path of ["/admin", "/admin/funil", "/admin/metricas", "/admin/tracking", "/admin/pedidos", "/admin/clientes", "/admin/produtos", "/admin/ofertas", "/admin/order-bumps", "/admin/upsells", "/admin/imagens", "/admin/landing", "/admin/landing/hero", "/admin/landing/demonstracao", "/admin/depoimentos", "/admin/faq", "/admin/pagamentos", "/admin/pagamentos/crediario", "/admin/webhooks", "/admin/configuracoes", "/admin/configuracoes?aba=entrega", "/admin/configuracoes?aba=rastreamento", "/admin/configuracoes?aba=sistema", "/admin/auditoria", "/admin/usuarios"]) {
    const res = await admin.goto(`${BASE}${path}`);
    const txt = await admin.locator("main").innerText().catch(() => "");
    ok(res?.status() === 200 && !/Application error|Unhandled Runtime Error/.test(txt), `admin ${path}`);
  }
  const prod = await admin.goto(`${BASE}/admin/produtos`);
  ok(prod?.status() === 200, "admin produtos");
  await Promise.all([admin.waitForURL(/\/admin\/produtos\/c/, { timeout: 90000 }), admin.locator("table a").first().click()]);
  await admin.getByText(/Imagens \(/).waitFor({ timeout: 60000 });
  ok(await admin.getByText(/Imagens \(/).isVisible(), "admin: produto com gerenciador de imagens");
  ok(await admin.getByRole("button", { name: "Enviar arquivo" }).first().isVisible() && (await admin.getByRole("button", { name: "Usar URL" }).first().isVisible()), "admin: imagem por arquivo e por URL");

  await admin.goto(`${BASE}/admin`);
  ok((await admin.content()).includes("Crediário"), "dashboard: indicadores de crediário");

  ok(errors.length === 0, `sem erros de JavaScript (${errors.slice(0, 3).join(" | ")})`);
  await browser.close();
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo.");
  process.exit(failures ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
