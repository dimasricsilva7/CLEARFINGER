"use server";

import { revalidatePath } from "next/cache";
import type { AdminRole } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { SETTING_DEFAULTS } from "@/lib/settings-defaults";
import { VALIDITY_FORMATS } from "@/lib/crediario";
import { refreshStore, withAdmin, type ActionResult } from "@/server/admin/guard";
import { bool, optStr, str } from "@/server/admin/forms";

const HEX = /^#[0-9a-f]{6}$/i;
const intRange = (min: number, max: number, msg: string) => (v: string) => (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? null : msg);
const VALIDATORS: Record<string, (v: string) => string | null> = {
  theme_primary: (v) => (HEX.test(v) ? null : "Cor primária inválida (use #RRGGBB)"),
  theme_navy: (v) => (HEX.test(v) ? null : "Cor azul-marinho inválida (use #RRGGBB)"),
  theme_background: (v) => (HEX.test(v) ? null : "Cor de fundo inválida (use #RRGGBB)"),
  meta_pixel_id: (v) => (!v || v.split(/[\s,;]+/).filter(Boolean).every((x) => /^\d{5,20}$/.test(x)) ? null : "IDs do Meta Pixel: só números, separados por vírgula"),
  ga_id: (v) => (!v || /^G-[A-Z0-9]{4,15}$/.test(v) ? null : "ID do GA4 no formato G-XXXXXXX"),
  gtm_id: (v) => (!v || /^GTM-[A-Z0-9]{4,12}$/.test(v) ? null : "ID do GTM no formato GTM-XXXXXXX"),
  google_ads_id: (v) => (!v || /^AW-\d{6,14}$/.test(v) ? null : "ID do Google Ads no formato AW-123456789"),
  google_ads_purchase_label: (v) => (!v || /^[A-Za-z0-9_-]{4,40}$/.test(v) ? null : "Rótulo de conversão inválido"),
  shipping_flat_cents: (v) => (/^\d{1,7}$/.test(v) ? null : "Frete inválido"),
  pix_expiration_minutes: intRange(5, 1440, "Validade do PIX entre 5 e 1440 minutos"),
  crediario_protocol_digits: intRange(4, 32, "Dígitos do protocolo entre 4 e 32"),
  crediario_cpf_digits: intRange(1, 11, "Dígitos do CPF entre 1 e 11"),
  crediario_max_installments: intRange(1, 24, "Máximo de parcelas entre 1 e 24"),
  crediario_validity_format: (v) => ((VALIDITY_FORMATS as readonly string[]).includes(v) ? null : "Formato de validade inválido"),
  crediario_method_label: (v) => (v ? null : "Informe o nome do método"),
  crediario_installment_text: (v) => (v.includes("{n}") && v.includes("{valor}") ? null : "O texto das parcelas precisa conter {n} e {valor}"),
  pix_method_label: (v) => (v ? null : "Informe o nome do método PIX"),
};
const URL_KEYS = ["logo_url", "logo_mark_url", "favicon_url", "og_image_url", "canonical_url", "instagram_url", "tiktok_url", "facebook_url", "youtube_url"];
const BOOL_KEYS = ["sticky_cta_enabled", "require_cpf", "meta_pixel_enabled", "meta_capi_enabled", "ga_enabled", "cookie_banner_enabled", "pix_enabled", "crediario_enabled", "crediario_validity_reject_expired", "robots_index"];

/** Salva somente as chaves presentes no formulário (cada aba/página envia as suas). */
export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const keys = String(fd.get("__keys") ?? "").split(",").filter((k) => k in SETTING_DEFAULTS);
    const current = Object.fromEntries((await db.siteSettings.findMany({ where: { key: { in: keys } } })).map((r) => [r.key, String(r.value)]));
    const changes: { key: string; before: string; after: string }[] = [];
    for (const key of keys) {
      let value = BOOL_KEYS.includes(key) ? String(bool(fd, key)) : str(fd, key, key.startsWith("policy_") ? 30_000 : 2000);
      if (key === "shipping_flat_cents") {
        const n = Number(value.replace(/[R$\s.]/g, "").replace(",", "."));
        value = Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100)) : "x";
      }
      if (["ga_id", "gtm_id", "google_ads_id"].includes(key)) value = value.toUpperCase();
      if (key.startsWith("theme_") && value && !value.startsWith("#")) value = `#${value}`;
      if (URL_KEYS.includes(key) && value && !/^(https:\/\/|\/)/.test(value)) return { error: `URL inválida em ${key} (use https://).` };
      const err = VALIDATORS[key]?.(value);
      if (err) return { error: err };
      const before = current[key] ?? SETTING_DEFAULTS[key];
      if (before === value) continue;
      await db.siteSettings.upsert({ where: { key }, update: { value, updatedBy: admin.email }, create: { key, value, updatedBy: admin.email } });
      changes.push({ key, before, after: value });
    }
    if (changes.length) {
      await audit(admin.id, "settings_updated", "settings", null, {
        summary: `Configurações alteradas: ${changes.map((c) => c.key).join(", ")}`,
        before: Object.fromEntries(changes.map((c) => [c.key, c.key.startsWith("policy_") ? `${c.before.length} caracteres` : c.before])),
        after: Object.fromEntries(changes.map((c) => [c.key, c.key.startsWith("policy_") ? `${c.after.length} caracteres` : c.after])),
      });
      refreshStore("settings");
    }
    return { ok: true, message: changes.length ? `${changes.length} configuração(ões) salva(s). O site já foi atualizado.` : "Nada foi alterado." };
  });
}

/** Restaura os textos padrão de um grupo (ex.: crediário). */
export async function resetSettingsGroup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const prefix = str(fd, "prefix", 20);
    if (!["crediario_", "pix_"].includes(prefix)) return { error: "Grupo inválido." };
    const { count } = await db.siteSettings.deleteMany({ where: { key: { startsWith: prefix } } });
    await audit(admin.id, "settings_reset", "settings", null, { summary: `Configurações "${prefix}*" restauradas ao padrão (${count})` });
    refreshStore("settings");
    revalidatePath("/admin/pagamentos");
    return { ok: true, message: "Textos padrão restaurados." };
  });
}

// ───────────── Usuários (somente OWNER) ─────────────

export async function saveAdminUser(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("OWNER", async (admin) => {
    const id = optStr(fd, "id", 40);
    const email = str(fd, "email", 160).toLowerCase();
    const role = (["OWNER", "ADMIN", "EDITOR"].includes(str(fd, "role", 10)) ? str(fd, "role", 10) : "EDITOR") as AdminRole;
    const password = String(fd.get("password") ?? "");
    const active = bool(fd, "active");
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "E-mail inválido." };
    if (password && password.length < 12) return { error: "A senha precisa ter pelo menos 12 caracteres." };
    if (id === admin.id && (role !== "OWNER" || !active)) return { error: "Você não pode remover seu próprio acesso de proprietário." };
    if (id) {
      const before = await db.adminUser.findUniqueOrThrow({ where: { id } });
      await db.adminUser.update({ where: { id }, data: { email, name: str(fd, "name", 80) || email, role, active, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
      if (!active || password) await db.adminSession.deleteMany({ where: { adminId: id } });
      await audit(admin.id, "admin_user_updated", "adminUser", id, { summary: `Usuário ${email} atualizado${password ? " (senha redefinida)" : ""}`, before: { role: before.role, active: before.active, email: before.email }, after: { role, active, email } });
    } else {
      if (!password) return { error: "Defina uma senha inicial (12+ caracteres)." };
      const created = await db.adminUser.create({ data: { email, name: str(fd, "name", 80) || email, role, active, passwordHash: await hashPassword(password) } });
      await audit(admin.id, "admin_user_created", "adminUser", created.id, { summary: `Usuário criado: ${email} (${role})` });
    }
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário salvo." };
  });
}

export async function changeOwnPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    if (next.length < 12) return { error: "A nova senha precisa ter pelo menos 12 caracteres." };
    if (!(await verifyPassword(current, admin.passwordHash))) return { error: "Senha atual incorreta." };
    await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
    await audit(admin.id, "password_changed", "adminUser", admin.id, { summary: "Senha alterada" });
    return { ok: true, message: "Senha alterada." };
  });
}
