/** Gera as imagens usadas nos e-mails (PNG/JPG — clientes de e-mail não exibem WebP/SVG). npx tsx scripts/email-assets.ts */
import sharp from "sharp";

async function main() {
  sharp.cache(false);
  // Logo sobre branco, 2x para telas retina (exibido com 180px de largura)
  await sharp("public/brand/logo.webp").resize({ width: 360 }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toFile("public/email/logo.png");
  // Foto oficial do produto (fundo branco), exibida com até 260px
  await sharp("public/brand/kit-photo.webp").resize({ width: 520 }).flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toFile("public/email/kit.jpg");
  for (const f of ["public/email/logo.png", "public/email/kit.jpg"]) {
    const m = await sharp(f).metadata();
    console.log(f, m.width, m.height);
  }
}
main();
