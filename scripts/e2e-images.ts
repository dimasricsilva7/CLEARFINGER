/**
 * Teste do envio de imagens pelo admin: arquivo do computador e URL externa.
 *   npx tsx scripts/e2e-images.ts http://localhost:3000 [url-de-imagem-https]
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const IMG_URL = process.argv[3] ?? "https://picsum.photos/id/1062/600/400.jpg";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(`${BASE}/admin/login`);
  await p.fill("#email", process.env.ADMIN_EMAIL!);
  await p.fill("#password", fs.readFileSync(".admin-dev-password", "utf8").trim());
  await Promise.all([p.waitForURL(`${BASE}/admin`, { timeout: 120000 }), p.getByRole("button", { name: "Entrar" }).click()]);
  await p.goto(`${BASE}/admin/configuracoes?aba=seo`);
  const field = p.locator("div", { has: p.getByText("Imagem de compartilhamento") }).last();
  let failures = 0;

  // 1) Arquivo do computador
  await field.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "public", "brand", "apple-icon.png"));
  await field.getByText("Imagem guardada no site").waitFor({ timeout: 60000 });
  const uploaded = await field.locator('input[type="hidden"]').inputValue();
  const r1 = await fetch(BASE + uploaded);
  console.log(/^\/media\/m.+\.webp$/.test(uploaded) && r1.ok && r1.headers.get("content-type") === "image/webp" ? "✓" : "✗", "arquivo enviado e servido:", uploaded, r1.status);
  if (!r1.ok) failures++;

  // 2) URL — cópia guardada no site
  if (!(await field.getByLabel("URL da imagem").isVisible())) await field.getByRole("button", { name: "Usar URL" }).click();
  await field.getByLabel("URL da imagem").fill(IMG_URL);
  await field.getByRole("button", { name: "Usar esta URL" }).click();
  await p.waitForFunction((prev) => (document.querySelector('input[name="og_image_url"]') as HTMLInputElement)?.value !== prev, uploaded, { timeout: 60000 }).catch(() => null);
  const copied = await field.locator('input[type="hidden"]').inputValue();
  const err = await field.locator(".text-red-600").allInnerTexts();
  console.log(copied !== uploaded && copied.startsWith("/media/") ? "✓" : "✗", "URL baixada para o site:", copied, err.join(" "));
  if (!(copied !== uploaded && copied.startsWith("/media/"))) failures++;

  // 3) URL — link direto
  if (!(await field.getByLabel("URL da imagem").isVisible())) await field.getByRole("button", { name: "Usar URL" }).click();
  await field.getByLabel("URL da imagem").fill(IMG_URL);
  await field.getByText("Guardar uma cópia otimizada").click();
  await field.getByRole("button", { name: "Usar esta URL" }).click();
  await p.waitForFunction((u) => (document.querySelector('input[name="og_image_url"]') as HTMLInputElement)?.value === u, IMG_URL, { timeout: 60000 }).catch(() => null);
  const direct = await field.locator('input[type="hidden"]').inputValue();
  console.log(direct === IMG_URL ? "✓" : "✗", "URL usada diretamente:", direct);
  if (direct !== IMG_URL) failures++;

  // 4) Link interno/privado é bloqueado (proteção SSRF)
  if (!(await field.getByLabel("URL da imagem").isVisible())) await field.getByRole("button", { name: "Usar URL" }).click();
  await field.getByLabel("URL da imagem").fill("http://127.0.0.1/x.png");
  await field.getByRole("button", { name: "Usar esta URL" }).click();
  await field.getByText(/não permitido/).waitFor({ timeout: 30000 }).then(() => console.log("✓ link interno bloqueado (SSRF)")).catch(() => { console.log("✗ link interno não foi bloqueado"); failures++; });

  // Biblioteca mostra as imagens
  await p.goto(`${BASE}/admin/imagens`);
  console.log((await p.locator("main img").count()) >= 4 ? "✓" : "✗", "biblioteca de imagens lista os envios");
  await b.close();
  process.exit(failures ? 1 : 0);
})();
