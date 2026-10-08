import type { Metadata } from "next";
import { db } from "@/lib/db";
import { EmptyState, PageHeader, inputCls } from "@/components/admin/ui";
import { CATEGORY_LABEL, MEDIA_CATEGORIES, isMediaCategory } from "@/utils/media";
import { MediaEditor, MediaLinkImport, MediaUploader } from "./MediaClient";

export const metadata: Metadata = { title: "Imagens" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const sp = await searchParams;
  const cat = isMediaCategory(sp.categoria) ? sp.categoria : undefined;
  const assets = await db.mediaAsset.findMany({
    where: { ...(cat ? { category: cat } : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { alt: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 300,
  });
  return (
    <>
      <PageHeader
        title="Imagens"
        description="Envie do computador (várias de uma vez) ou por link. As imagens são otimizadas (WebP) e guardadas no próprio site, com cache de CDN. Depois escolha-as em Produtos, Ofertas, Landing e Configurações."
        actions={<MediaUploader category={cat ?? "OUTROS"} />}
      />
      <MediaLinkImport category={cat ?? "OUTROS"} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nome ou alt" className={`${inputCls} !w-60`} />
        <select name="categoria" defaultValue={cat ?? ""} className={`${inputCls} !w-56`}>
          <option value="">Todas as categorias</option>
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {assets.length === 0 ? (
        <EmptyState title="Nenhuma imagem" text="Envie fotos reais do produto, da embalagem e de demonstração." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((a) => (
            <MediaEditor key={a.id} asset={{ id: a.id, name: a.name, url: a.url, alt: a.alt, category: a.category, active: a.active, size: a.size, width: a.width, height: a.height, storage: a.storage }} />
          ))}
        </div>
      )}
    </>
  );
}
