/**
 * Remove o fundo claro de uma foto de produto (preenchimento a partir das bordas) e gera PNG/WebP com transparência.
 *   npx tsx scripts/cutout.ts entrada.png saida.webp
 */
import sharp from "sharp";

async function run(input: string, output: string) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const isBg = (i: number) => {
    const [r, g, b] = px(i);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min > 200 && max - min < 22; // claro e quase sem cor
  };
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (bg[i] || !isBg(i)) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  // Alfa: fundo = 0; borda suavizada pelos vizinhos de fundo
  const out = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { out[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    let n = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      c++; if (bg[yy * w + xx]) n++;
    }
    out[i * 4 + 3] = Math.round(255 * (1 - (n / c) * 0.85));
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).webp({ quality: 90, alphaQuality: 90 }).toFile(output);
  console.log("ok", output);
}
run(process.argv[2], process.argv[3]);
