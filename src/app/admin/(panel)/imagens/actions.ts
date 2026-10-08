"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { MEDIA_CATEGORIES } from "@/utils/media";
import { withAdmin, withAdminVoid, type ActionResult } from "@/server/admin/guard";
import { str } from "@/server/admin/forms";

const schema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  alt: z.string().trim().max(200),
  category: z.enum(MEDIA_CATEGORIES),
  active: z.boolean(),
});

export async function updateMediaAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const parsed = schema.safeParse({ id: fd.get("id"), name: fd.get("name"), alt: fd.get("alt") ?? "", category: fd.get("category"), active: fd.get("active") === "on" });
    if (!parsed.success) return { error: "Dados inválidos." };
    const { id, ...data } = parsed.data;
    await db.mediaAsset.update({ where: { id }, data });
    await audit(admin.id, "media_updated", "media", id, { summary: `Imagem "${data.name}" atualizada` });
    revalidatePath("/admin/imagens");
    return { ok: true, message: "Salvo." };
  });
}

/** Onde a imagem está em uso (impede excluir algo que quebraria o site). */
async function usage(url: string) {
  const [images, offers, sections, testimonials, settings] = await Promise.all([
    db.productImage.count({ where: { url } }),
    db.productOffer.count({ where: { imageUrl: url } }),
    db.landingSection.findMany({ select: { imageUrl: true, config: true } }),
    db.testimonial.count({ where: { avatarUrl: url } }),
    db.siteSettings.findMany({ select: { value: true } }),
  ]);
  const inSections = sections.filter((s) => s.imageUrl === url || JSON.stringify(s.config).includes(url)).length;
  const inSettings = settings.filter((s) => s.value === url).length;
  return images + offers + inSections + testimonials + inSettings;
}

export async function deleteMediaAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset) return { error: "Imagem não encontrada." };
    if (await usage(asset.url)) return { error: "Esta imagem está em uso (produto, oferta, landing, depoimento ou configurações). Troque-a lá antes de excluir." };
    await db.mediaAsset.delete({ where: { id } });
    await audit(admin.id, "media_deleted", "media", id, { summary: `Imagem excluída: ${asset.name}`, details: { url: asset.url } });
    revalidatePath("/admin/imagens");
    return { ok: true, message: "Imagem excluída." };
  });
}

export async function moveMediaAction(fd: FormData) {
  await withAdminVoid("EDITOR", async () => {
    const a = await db.mediaAsset.findUniqueOrThrow({ where: { id: str(fd, "id", 40) } });
    const list = await db.mediaAsset.findMany({ where: { category: a.category }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
    const i = list.findIndex((x) => x.id === a.id);
    const j = i + (str(fd, "dir", 4) === "up" ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.$transaction(list.map((x, idx) => db.mediaAsset.update({ where: { id: x.id }, data: { sortOrder: idx + 1 } })));
    revalidatePath("/admin/imagens");
  });
}
