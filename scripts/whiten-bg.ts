/**
 * Deixa o fundo da foto oficial do produto em branco puro (imagem continua 100% opaca).
 * Só clareia pixels de fundo conectados à borda; a sombra suave e o produto não mudam.
 *   npx tsx scripts/whiten-bg.ts entrada.png public/brand/kit-photo.webp
 */
import sharp from "sharp";

async function run(input: string, output: string) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const isBg = (i: number) => {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    return Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 16;
  };
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (bg[i] || !isBg(i)) continue;
    bg[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    if (!bg[i]) continue;
    // transição suave: quanto mais claro, mais perto do branco puro
    for (let c = 0; c < 3; c++) out[i * 3 + c] = 255;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).resize({ width: 1200 }).webp({ quality: 88 }).toFile(output);
  console.log("ok", output);
}
run(process.argv[2], process.argv[3]);
