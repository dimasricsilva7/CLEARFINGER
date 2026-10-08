import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashIp, randomToken, sha256 } from "@/lib/crypto";
import { getClientIp } from "@/lib/request";
import { decodeEnvHash } from "./hash";

export const ADMIN_COOKIE = "cf_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const MAX_FAILS_PER_KEY = 5;
const FAIL_WINDOW_MS = 1000 * 60 * 15;
let _dummy: string | null = null;
const dummyHash = () => (_dummy ??= bcrypt.hashSync("clearfinger-dummy", 12));

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** Brute force: bloqueia após N falhas em 15 min por e-mail e por IP (persistente no banco). */
export async function isLoginBlocked(email: string, ipHash: string | null) {
  const since = new Date(Date.now() - FAIL_WINDOW_MS);
  const keys = [`email:${email}`, ...(ipHash ? [`ip:${ipHash}`] : [])];
  const counts = await Promise.all(
    keys.map((key) => db.loginAttempt.count({ where: { key, success: false, createdAt: { gte: since } } }))
  );
  return counts.some((c, i) => c >= (keys[i].startsWith("ip:") ? MAX_FAILS_PER_KEY * 3 : MAX_FAILS_PER_KEY));
}

export async function recordLoginAttempt(email: string, ipHash: string | null, success: boolean) {
  const data = [{ key: `email:${email}`, success }, ...(ipHash ? [{ key: `ip:${ipHash}`, success }] : [])];
  await db.loginAttempt.createMany({ data });
}

export { decodeEnvHash };

/**
 * Valida credenciais. Se ainda não houver admin no banco, o primeiro acesso é
 * feito com ADMIN_EMAIL + ADMIN_PASSWORD_HASH (variáveis de ambiente) e o
 * usuário OWNER é criado automaticamente.
 */
export async function authenticate(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    if (!existing.active) return null;
    return (await verifyPassword(password, existing.passwordHash)) ? existing : null;
  }

  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envHash = decodeEnvHash(process.env.ADMIN_PASSWORD_HASH);
  if (!envEmail || !envHash || email !== envEmail) {
    await verifyPassword(password, dummyHash()); // tempo de resposta constante
    return null;
  }
  if (!(await verifyPassword(password, envHash))) return null;

  return db.adminUser.create({ data: { email, name: "Administrador", passwordHash: envHash, role: "OWNER" } });
}

export async function createSession(adminId: string) {
  const token = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.adminSession.create({
    data: {
      adminId,
      tokenHash: sha256(token),
      expiresAt,
      ipHash: hashIp(getClientIp(h)),
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
    },
  });
  await db.adminUser.update({ where: { id: adminId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: sha256(token) } }).catch(() => {});
  jar.delete(ADMIN_COOKIE);
}

export async function getCurrentAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
  if (!session || session.expiresAt < new Date() || !session.admin.active) return null;
  return session.admin;
}

/** Para Server Components e Server Actions do admin. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
