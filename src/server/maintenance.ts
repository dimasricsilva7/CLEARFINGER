/** Rotinas de manutenção (sem "server-only" para poderem rodar via tsx). */
import type { db as Db } from "@/lib/db";
import { decodeEnvHash } from "@/lib/auth/hash";

/** Define a senha do administrador ADMIN_EMAIL a partir de ADMIN_PASSWORD_HASH (recuperação de acesso). */
export async function resetAdminFromEnv(target: typeof Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = decodeEnvHash(process.env.ADMIN_PASSWORD_HASH);
  if (!email || !hash) throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD_HASH ausentes");
  const admin = await target.adminUser.upsert({
    where: { email },
    update: { passwordHash: hash, active: true, role: "OWNER" },
    create: { email, name: "Administrador", passwordHash: hash, role: "OWNER" },
  });
  await target.adminSession.deleteMany({ where: { adminId: admin.id } });
  await target.loginAttempt.deleteMany({ where: { key: `email:${email}` } });
  await target.auditLog.create({ data: { action: "admin_password_reset", entity: "adminUser", entityId: admin.id, summary: `Senha de ${email} redefinida via variável de ambiente` } });
  return { email, reset: true };
}
