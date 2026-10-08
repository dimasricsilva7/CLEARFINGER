"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, createSession, destroySession, getCurrentAdmin, isLoginBlocked, recordLoginAttempt } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashIp } from "@/lib/crypto";
import { getClientIp } from "@/lib/request";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(1).max(200) });

export async function loginAction(_: { error?: string; email?: string } | undefined, formData: FormData): Promise<{ error?: string; email?: string }> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe e-mail e senha." };
  const { email, password } = parsed.data;
  const ipHash = hashIp(getClientIp(await headers()));

  if (await isLoginBlocked(email, ipHash)) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.", email };
  }
  const admin = await authenticate(email, password);
  await recordLoginAttempt(email, ipHash, Boolean(admin));
  if (!admin) {
    await audit(null, "login_failed", "admin", null, { summary: `Falha de login para ${email}` });
    return { error: "E-mail ou senha inválidos.", email };
  }
  await createSession(admin.id);
  await audit(admin.id, "login", "admin", admin.id);
  redirect("/admin");
}

export async function logoutAction() {
  const admin = await getCurrentAdmin();
  if (admin) await audit(admin.id, "logout", "admin", admin.id);
  await destroySession();
  redirect("/admin/login");
}
