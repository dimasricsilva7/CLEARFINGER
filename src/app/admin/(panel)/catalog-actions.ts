"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma, ProductImageRole } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ICONS } from "@/lib/domain";
import { slugify } from "@/utils/format";
import { refreshStore, withAdmin, withAdminVoid, type ActionResult } from "@/server/admin/guard";
import { bool, int, jsonArray, optStr, parseMoney, str } from "@/server/admin/forms";

const asRecord = (v: unknown) => v as Record<string, unknown>;
const url = (fd: FormData, k: string) => {
  const v = optStr(fd, k, 1000);
  return v && /^(https:\/\/|\/)/.test(v) ? v : null;
};
const ROLES: ProductImageRole[] = ["MAIN", "SECONDARY", "GALLERY"];

// ───────────── Produto ─────────────

export async function saveProduct(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = optStr(fd, "id", 40);
    const name = str(fd, "name", 160);
    const priceCents = parseMoney(fd.get("price"));
    if (!name) return { error: "Informe o nome do produto." };
    if (priceCents == null || priceCents <= 0) return { error: "Informe um preço válido." };
    const compare = parseMoney(fd.get("compareAtPrice"));
    const stockRaw = str(fd, "stockQuantity", 10);
    const data = {
      name,
      shortName: optStr(fd, "shortName", 80),
      slug: slugify(str(fd, "slug", 80) || name),
      sku: str(fd, "sku", 40).toUpperCase() || slugify(name).toUpperCase().slice(0, 30),
      shortDescription: optStr(fd, "shortDescription", 400),
      description: optStr(fd, "description", 6000),
      priceCents,
      compareAtPriceCents: compare && compare > priceCents ? compare : null,
      discountLabel: optStr(fd, "discountLabel", 40),
      stockQuantity: stockRaw === "" ? null : Math.max(0, int(fd, "stockQuantity", 0)),
      active: bool(fd, "active"),
      videoUrl: url(fd, "videoUrl"),
      badge: optStr(fd, "badge", 60),
      benefits: jsonArray<{ icon?: string; title?: string; text?: string }>(fd, "benefits")
        .filter((b) => b?.title)
        .slice(0, 12)
        .map((b) => ({ icon: (ICONS as readonly string[]).includes(b.icon ?? "") ? b.icon : "check", title: String(b.title).slice(0, 90), text: String(b.text ?? "").slice(0, 280) })) as Prisma.InputJsonValue,
      specs: jsonArray<{ label?: string; value?: string }>(fd, "specs")
        .filter((s) => s?.label && s?.value)
        .slice(0, 20)
        .map((s) => ({ label: String(s.label).slice(0, 60), value: String(s.value).slice(0, 200) })) as Prisma.InputJsonValue,
      seoTitle: optStr(fd, "seoTitle", 70),
      seoDescription: optStr(fd, "seoDescription", 170),
    };
    let productId = id;
    if (id) {
      const before = await db.product.findUniqueOrThrow({ where: { id } });
      const after = await db.product.update({ where: { id }, data });
      await audit(admin.id, "product_updated", "product", id, { summary: `Produto "${after.name}" atualizado`, before: asRecord(before), after: asRecord(after) });
    } else {
      const created = await db.product.create({ data });
      productId = created.id;
      await audit(admin.id, "product_created", "product", created.id, { summary: `Produto criado: ${created.name}` });
    }
    refreshStore("catalog");
    revalidatePath("/admin/produtos");
    if (!id) redirect(`/admin/produtos/${productId}`);
    return { ok: true, message: "Produto salvo. A landing já foi atualizada." };
  });
}

// ───────────── Imagens do produto ─────────────

async function demoteOthers(productId: string, role: ProductImageRole, exceptId?: string) {
  if (role === "GALLERY") return;
  await db.productImage.updateMany({ where: { productId, role, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, data: { role: "GALLERY" } });
}

export async function addProductImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const productId = str(fd, "productId", 40);
    const u = url(fd, "url");
    if (!u) return { error: "Escolha uma imagem (biblioteca, upload ou link https)." };
    const role = (ROLES.includes(str(fd, "role", 12) as ProductImageRole) ? str(fd, "role", 12) : "GALLERY") as ProductImageRole;
    await demoteOthers(productId, role);
    const last = await db.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
    const img = await db.productImage.create({ data: { productId, url: u, alt: str(fd, "alt", 200), role, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit(admin.id, "product_image_added", "product", productId, { summary: `Imagem ${role} adicionada`, details: { url: img.url } });
    refreshStore("catalog");
    revalidatePath(`/admin/produtos/${productId}`);
    return { ok: true, message: "Imagem adicionada." };
  });
}

export async function updateProductImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const img = await db.productImage.findUniqueOrThrow({ where: { id: str(fd, "id", 40) } });
    const role = (ROLES.includes(str(fd, "role", 12) as ProductImageRole) ? str(fd, "role", 12) : img.role) as ProductImageRole;
    const newUrl = url(fd, "url") ?? img.url;
    await demoteOthers(img.productId, role, img.id);
    await db.productImage.update({ where: { id: img.id }, data: { role, alt: str(fd, "alt", 200), url: newUrl } });
    await audit(admin.id, "product_image_updated", "product", img.productId, { summary: `Imagem atualizada (${role})`, before: { role: img.role, url: img.url, alt: img.alt }, after: { role, url: newUrl, alt: str(fd, "alt", 200) } });
    refreshStore("catalog");
    revalidatePath(`/admin/produtos/${img.productId}`);
    return { ok: true, message: "Imagem salva." };
  });
}

export async function moveProductImage(fd: FormData) {
  await withAdminVoid("EDITOR", async () => {
    const img = await db.productImage.findUniqueOrThrow({ where: { id: str(fd, "id", 40) } });
    const list = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const i = list.findIndex((x) => x.id === img.id);
    const j = i + (str(fd, "dir", 4) === "up" ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.$transaction(list.map((x, idx) => db.productImage.update({ where: { id: x.id }, data: { sortOrder: idx + 1 } })));
    refreshStore("catalog");
    revalidatePath(`/admin/produtos/${img.productId}`);
  });
}

export async function deleteProductImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const img = await db.productImage.delete({ where: { id: str(fd, "id", 40) } });
    await audit(admin.id, "product_image_deleted", "product", img.productId, { summary: `Imagem removida (${img.role})`, details: { url: img.url } });
    refreshStore("catalog");
    revalidatePath(`/admin/produtos/${img.productId}`);
    return { ok: true, message: "Imagem removida." };
  });
}

// ───────────── Ofertas / kits ─────────────

export async function saveOffer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = optStr(fd, "id", 40);
    const name = str(fd, "name", 80);
    const priceCents = parseMoney(fd.get("price"));
    const productId = str(fd, "productId", 40);
    if (!name) return { error: "Informe o nome da oferta." };
    if (priceCents == null || priceCents <= 0) return { error: "Informe um preço válido." };
    if (!(await db.product.findUnique({ where: { id: productId }, select: { id: true } }))) return { error: "Produto inválido." };
    const compare = parseMoney(fd.get("compareAtPrice"));
    const data = {
      productId,
      name,
      slug: slugify(str(fd, "slug", 60) || name),
      quantity: Math.max(1, Math.min(50, int(fd, "quantity", 1))),
      priceCents,
      compareAtPriceCents: compare && compare > priceCents ? compare : null,
      discountLabel: optStr(fd, "discountLabel", 30),
      badge: optStr(fd, "badge", 40),
      highlight: bool(fd, "highlight"),
      description: optStr(fd, "description", 300),
      imageUrl: url(fd, "imageUrl"),
      sortOrder: int(fd, "sortOrder", 0),
      active: bool(fd, "active"),
    };
    if (data.badge && /mais vendid|best ?seller|n[ºo°] ?1/i.test(data.badge) && !bool(fd, "confirmBadge")) {
      return { error: `O selo "${data.badge}" afirma um resultado de vendas. Confirme que ele é verdadeiro (caixa de confirmação) ou use outro texto, como "Recomendado".` };
    }
    if (data.highlight) await db.productOffer.updateMany({ where: { productId, ...(id ? { NOT: { id } } : {}) }, data: { highlight: false } });
    if (id) {
      const before = await db.productOffer.findUniqueOrThrow({ where: { id } });
      const after = await db.productOffer.update({ where: { id }, data });
      if (before.priceCents !== after.priceCents) await db.priceHistory.create({ data: { offerId: id, oldPriceCents: before.priceCents, newPriceCents: after.priceCents, adminId: admin.id } });
      await audit(admin.id, "offer_updated", "productOffer", id, { summary: `Oferta "${after.name}" atualizada`, before: asRecord(before), after: asRecord(after) });
    } else {
      const created = await db.productOffer.create({ data });
      await db.priceHistory.create({ data: { offerId: created.id, oldPriceCents: null, newPriceCents: created.priceCents, adminId: admin.id } });
      await audit(admin.id, "offer_created", "productOffer", created.id, { summary: `Oferta criada: ${created.name}` });
    }
    refreshStore("catalog");
    revalidatePath("/admin/ofertas");
    return { ok: true, message: "Oferta salva. A landing e o checkout já usam o novo valor." };
  });
}

export async function deleteOffer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = str(fd, "id", 40);
    const used = await db.orderItem.count({ where: { offerId: id } });
    if (used) {
      await db.productOffer.update({ where: { id }, data: { active: false } });
      refreshStore("catalog");
      revalidatePath("/admin/ofertas");
      return { ok: true, message: "A oferta tem pedidos e foi apenas desativada (o histórico é preservado)." };
    }
    const o = await db.productOffer.delete({ where: { id } });
    await audit(admin.id, "offer_deleted", "productOffer", id, { summary: `Oferta removida: ${o.name}` });
    refreshStore("catalog");
    revalidatePath("/admin/ofertas");
    return { ok: true, message: "Oferta removida." };
  });
}
