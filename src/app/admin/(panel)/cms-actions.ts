"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ICONS } from "@/lib/domain";
import { refreshStore, withAdmin, withAdminVoid, type ActionResult } from "@/server/admin/guard";
import { bool, int, jsonArray, optStr, str, stringList } from "@/server/admin/forms";

const url = (fd: FormData, k: string) => {
  const v = optStr(fd, k, 1000);
  return v && /^(https:\/\/|\/)/.test(v) ? v : null;
};
const asRecord = (v: unknown) => v as Record<string, unknown>;
const iconItems = (fd: FormData, k: string) =>
  jsonArray<{ icon?: string; title?: string; text?: string }>(fd, k)
    .filter((i) => i?.title)
    .slice(0, 12)
    .map((i) => ({ icon: (ICONS as readonly string[]).includes(i.icon ?? "") ? i.icon : "check", title: String(i.title).slice(0, 90), text: String(i.text ?? "").slice(0, 280) }));

/** Campos específicos de cada tipo de seção → `config`. */
function parseConfig(type: string, fd: FormData, prev: Record<string, unknown>): Record<string, unknown> {
  const c: Record<string, unknown> = { ...prev };
  switch (type) {
    case "hero":
      c.eyebrow = str(fd, "cfg_eyebrow", 90);
      c.badges = stringList(fd, "cfg_badges").slice(0, 4);
      break;
    case "pain":
      c.items = stringList(fd, "cfg_items").slice(0, 8);
      break;
    case "solution":
      c.points = stringList(fd, "cfg_points").slice(0, 8);
      break;
    case "how_it_works":
      c.steps = jsonArray<{ title?: string; text?: string }>(fd, "cfg_steps").filter((s) => s?.title).slice(0, 6).map((s) => ({ title: String(s.title).slice(0, 60), text: String(s.text ?? "").slice(0, 300) }));
      c.note = str(fd, "cfg_note", 300);
      break;
    case "demo":
      c.beforeUrl = url(fd, "cfg_beforeUrl") ?? "";
      c.applicationUrl = url(fd, "cfg_applicationUrl") ?? "";
      c.afterUrl = url(fd, "cfg_afterUrl") ?? "";
      c.posterUrl = url(fd, "cfg_posterUrl") ?? "";
      c.caption = str(fd, "cfg_caption", 300);
      break;
    case "benefits":
    case "trust":
      c.items = iconItems(fd, "cfg_items");
      break;
  }
  return c;
}

export async function saveSection(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const key = str(fd, "key", 40);
    const before = await db.landingSection.findUniqueOrThrow({ where: { key } });
    if (before.type === "demo" && bool(fd, "active") && (url(fd, "cfg_beforeUrl") || url(fd, "cfg_afterUrl")) && !bool(fd, "confirmReal")) {
      return { error: "Confirme que as imagens de antes e depois são reais e autorizadas para publicá-las." };
    }
    const config = parseConfig(before.type, fd, (before.config ?? {}) as Record<string, unknown>);
    const after = await db.landingSection.update({
      where: { key },
      data: {
        active: bool(fd, "active"),
        label: str(fd, "label", 60) || before.label,
        title: optStr(fd, "title", 200),
        subtitle: optStr(fd, "subtitle", 500),
        body: optStr(fd, "body", 4000),
        imageUrl: url(fd, "imageUrl"),
        videoUrl: url(fd, "videoUrl"),
        ctaLabel: optStr(fd, "ctaLabel", 60),
        ctaTarget: optStr(fd, "ctaTarget", 200),
        config: config as Prisma.InputJsonValue,
      },
    });
    await audit(admin.id, "landing_section_updated", "landingSection", key, { summary: `Seção "${before.label}" atualizada`, before: asRecord(before), after: asRecord(after) });
    refreshStore("landing");
    revalidatePath("/admin/landing");
    return { ok: true, message: "Seção salva. A landing page já foi atualizada." };
  });
}

export async function moveSection(fd: FormData) {
  await withAdminVoid("EDITOR", async (admin) => {
    const key = str(fd, "key", 40);
    const dir = str(fd, "dir", 4) === "up" ? -1 : 1;
    const list = await db.landingSection.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, label: true } });
    const i = list.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.$transaction(list.map((s, idx) => db.landingSection.update({ where: { key: s.key }, data: { sortOrder: idx + 1 } })));
    await audit(admin.id, "landing_reordered", "landingSection", key, { summary: `Ordem da landing: "${list[j].label}" movida` });
    refreshStore("landing");
    revalidatePath("/admin/landing");
  });
}

export async function toggleSection(fd: FormData) {
  await withAdminVoid("EDITOR", async (admin) => {
    const s = await db.landingSection.findUniqueOrThrow({ where: { key: str(fd, "key", 40) } });
    await db.landingSection.update({ where: { key: s.key }, data: { active: !s.active } });
    await audit(admin.id, "landing_section_updated", "landingSection", s.key, { summary: `Seção "${s.label}" ${s.active ? "ocultada" : "exibida"}`, before: { active: s.active }, after: { active: !s.active } });
    refreshStore("landing");
    revalidatePath("/admin/landing");
  });
}

// ───────────── FAQ ─────────────

export async function saveFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = optStr(fd, "id", 40);
    const data = { question: str(fd, "question", 200), answer: str(fd, "answer", 3000), sortOrder: int(fd, "sortOrder", 0), active: bool(fd, "active") };
    if (!data.question || !data.answer) return { error: "Informe pergunta e resposta." };
    if (data.active && data.answer.includes("[PREENCHER]")) return { error: "Complete a resposta (remova [PREENCHER]) antes de publicar." };
    if (id) {
      const before = await db.faq.findUniqueOrThrow({ where: { id } });
      const after = await db.faq.update({ where: { id }, data });
      await audit(admin.id, "faq_updated", "faq", id, { summary: `FAQ: "${after.question}"`, before: asRecord(before), after: asRecord(after) });
    } else {
      const created = await db.faq.create({ data });
      await audit(admin.id, "faq_created", "faq", created.id, { summary: `FAQ criada: "${created.question}"` });
    }
    refreshStore("faq");
    revalidatePath("/admin/faq");
    return { ok: true, message: "Salvo." };
  });
}

export async function deleteFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const f = await db.faq.delete({ where: { id: str(fd, "id", 40) } });
    await audit(admin.id, "faq_deleted", "faq", f.id, { summary: `FAQ removida: "${f.question}"` });
    refreshStore("faq");
    revalidatePath("/admin/faq");
    return { ok: true, message: "Removida." };
  });
}

// ───────────── Depoimentos (somente reais) ─────────────

export async function saveTestimonial(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = optStr(fd, "id", 40);
    const data = {
      name: str(fd, "name", 80),
      text: str(fd, "text", 1500),
      rating: Math.max(1, Math.min(5, int(fd, "rating", 5))),
      avatarUrl: url(fd, "avatarUrl"),
      city: optStr(fd, "city", 80),
      active: bool(fd, "active"),
      sortOrder: int(fd, "sortOrder", 0),
    };
    if (!data.name || !data.text) return { error: "Informe nome e texto do depoimento." };
    if (data.active && !bool(fd, "confirmReal")) return { error: "Confirme que o depoimento é real e autorizado pelo cliente para publicá-lo." };
    if (id) {
      const before = await db.testimonial.findUniqueOrThrow({ where: { id } });
      const after = await db.testimonial.update({ where: { id }, data });
      await audit(admin.id, "testimonial_updated", "testimonial", id, { summary: `Depoimento de ${after.name} ${before.active !== after.active ? (after.active ? "publicado" : "ocultado") : "atualizado"}`, before: asRecord(before), after: asRecord(after) });
    } else {
      const created = await db.testimonial.create({ data });
      await audit(admin.id, "testimonial_created", "testimonial", created.id, { summary: `Depoimento cadastrado: ${created.name}` });
    }
    refreshStore("testimonials");
    revalidatePath("/admin/depoimentos");
    return { ok: true, message: "Salvo." };
  });
}

export async function deleteTestimonial(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const t = await db.testimonial.delete({ where: { id: str(fd, "id", 40) } });
    await audit(admin.id, "testimonial_deleted", "testimonial", t.id, { summary: `Depoimento removido: ${t.name}` });
    refreshStore("testimonials");
    revalidatePath("/admin/depoimentos");
    return { ok: true, message: "Removido." };
  });
}
