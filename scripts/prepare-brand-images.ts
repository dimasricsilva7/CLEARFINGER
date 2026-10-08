/**
 * Converte as imagens originais da marca para WebP otimizado em /public/brand.
 *   npm run brand:images -- "C:/caminho/da/pasta"
 * As imagens podem ser trocadas depois pelo admin (Imagens / Produtos / Configurações).
 */
import path from "path";
import sharp from "sharp";

const src = process.argv[2] ?? path.join(process.env.USERPROFILE ?? "", "Downloads");
const out = path.join(process.cwd(), "public", "brand");

async function run() {
  // Kit (caixa + frasco) — imagem principal do produto
  await sharp(path.join(src, "Kit Clearfinger_ Removedor de Manchas de Nicotina.png")).resize({ width: 1200 }).webp({ quality: 84 }).toFile(path.join(out, "kit.webp"));
  // Logo horizontal — recorta o espaço em branco
  await sharp(path.join(src, "Logo CLEARFINGER com Folha Azul.png")).trim({ threshold: 10 }).resize({ width: 720 }).webp({ quality: 90 }).toFile(path.join(out, "logo.webp"));
  // Logo circular (selo / ícone)
  const circ = path.join(src, "Logo Circular ClearFinger em Azul.png");
  await sharp(circ).resize(512, 512).webp({ quality: 88 }).toFile(path.join(out, "logo-circular.webp"));
  await sharp(circ).resize(180, 180).png().toFile(path.join(out, "apple-icon.png"));
  await sharp(circ).resize(64, 64).png().toFile(path.join(out, "favicon.png"));
  console.log("Imagens geradas em", out);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
