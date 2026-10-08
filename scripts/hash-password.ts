/**
 * Gera o valor de ADMIN_PASSWORD_HASH para o primeiro administrador.
 *   npm run admin:hash -- "sua-senha-forte"
 * Cole a saída na variável de ambiente (Vercel → Settings → Environment Variables).
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Uso: npm run admin:hash -- \"senha-com-pelo-menos-12-caracteres\"");
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
console.log(`ADMIN_PASSWORD_HASH=b64:${Buffer.from(hash).toString("base64")}`);
