/** Captura de um seletor (rolando antes para carregar imagens lazy). npx tsx scripts/shot-section.ts url seletor saida.png [largura] */
import { chromium } from "playwright";
const [url, sel, out, w] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: Number(w ?? 390), height: 844 }, isMobile: Number(w ?? 390) < 600 })).newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.cookie = "cf_consent=granted; path=/");
  await p.reload({ waitUntil: "networkidle" });
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await el.screenshot({ path: out });
  await b.close();
})();
