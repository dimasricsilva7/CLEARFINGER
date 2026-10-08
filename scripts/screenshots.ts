/**
 * Capturas de tela para revisão visual (mobile e desktop).
 *   npx tsx scripts/screenshots.ts [baseUrl] [caminho] [saida]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const path = process.argv[3] ?? "/";
const out = process.argv[4] ?? "screenshots";

async function run() {
  const browser = await chromium.launch();
  for (const [name, width, height] of [["m375", 375, 740], ["m390", 390, 844], ["d1440", 1440, 900]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, userAgent: width < 500 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined });
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(name, "overflow-x:", overflow);
    await page.screenshot({ path: `${out}/${name}-fold.png` });
    await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
    await ctx.close();
  }
  await browser.close();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
