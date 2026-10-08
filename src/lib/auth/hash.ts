/**
 * ADMIN_PASSWORD_HASH aceita o hash bcrypt puro ou codificado como `b64:<base64>`
 * (recomendado: evita que o `$` do bcrypt seja interpretado por ferramentas de .env).
 */
export function decodeEnvHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().replace(/^['"]|['"]$/g, "");
  if (v.startsWith("b64:")) return Buffer.from(v.slice(4), "base64").toString("utf8");
  return v;
}
