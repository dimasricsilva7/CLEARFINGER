/**
 * Revisão mobile: 375 / 390 / 414 px em várias páginas — verifica rolagem horizontal e salva capturas por seção.
 *   npx tsx scripts/review-mobile.ts [baseUrl] [saida]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const PAGES = ["/", "/checkout", "/rastrear-pedido", "/contato"];
const SECTIONS = ["#hero-cta", "#como-funciona", "#ofertas"];

async function run() {
  const browser = await chromium.launch();
  let failures = 0;
  for (const width of [375, 390, 414]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) failures++;
      console.log(`${width}px ${path} overflow-x: ${overflow}`);
      const slug = path === "/" ? "home" : path.slice(1);
      await page.screenshot({ path: `${out}/m${width}-${slug}.png`, fullPage: path !== "/" });
      if (path === "/" && width === 390) {
        for (const sel of SECTIONS) {
          const el = await page.$(sel === "#hero-cta" ? "section" : sel);
          if (el) await el.screenshot({ path: `${out}/m390-sec-${sel.slice(1)}.png` });
        }
        const strips = await page.$$eval("[data-testid=shipping-strip]", (els) => els.length);
        console.log("faixas de frete na landing:", strips);
      }
    }
    await ctx.close();
  }
  await browser.close();
  if (failures) {
    console.error(`${failures} página(s) com rolagem horizontal`);
    process.exit(1);
  }
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
