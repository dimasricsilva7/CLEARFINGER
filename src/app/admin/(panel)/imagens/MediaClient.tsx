"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { LinkImport, UploadButton } from "@/components/admin/media";
import { CATEGORY_LABEL, MEDIA_CATEGORIES } from "@/utils/media";
import { inputCls, labelCls } from "@/components/admin/ui";
import { deleteMediaAction, moveMediaAction, updateMediaAction } from "./actions";

export function MediaUploader({ category }: { category: string }) {
  const router = useRouter();
  return <UploadButton category={category} multiple label="Enviar do computador" onUploaded={() => router.refresh()} />;
}

export function MediaLinkImport({ category }: { category: string }) {
  const router = useRouter();
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-slate-900">Adicionar imagem por link</p>
      <LinkImport category={category} onImported={() => router.refresh()} />
    </div>
  );
}

type A = { id: string; name: string; url: string; alt: string; category: string; active: boolean; size: number | null; width: number | null; height: number | null; storage: string };

export function MediaEditor({ asset }: { asset: A }) {
  const small = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="block bg-slate-100">
        <img src={asset.url} alt={asset.alt} className={`aspect-[4/3] w-full object-contain ${asset.active ? "" : "opacity-40"}`} loading="lazy" />
      </a>
      <div className="p-3">
        <p className="mb-2 text-[11px] text-slate-500">
          {asset.width && asset.height ? `${asset.width}×${asset.height}px · ` : ""}
          {asset.size ? `${Math.round(asset.size / 1024)} KB · ` : ""}
          {asset.storage === "db" ? "guardada no site" : asset.storage === "static" ? "arquivo da marca" : "link externo"}
        </p>
        <ActionForm action={updateMediaAction} className="space-y-2">
          <input type="hidden" name="id" value={asset.id} />
          <input name="name" defaultValue={asset.name} className={inputCls} aria-label="Nome" />
          <input name="alt" defaultValue={asset.alt} placeholder="Texto alternativo (acessibilidade/SEO)" className={inputCls} aria-label="Alt" />
          <div>
            <label className={labelCls}>Categoria</label>
            <select name="category" defaultValue={asset.category} className={inputCls}>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={asset.active} /> Ativa
            </label>
            <button type="button" className="text-xs text-slate-500 underline" onClick={() => navigator.clipboard.writeText(asset.url)}>
              Copiar URL
            </button>
          </div>
          <SubmitButton className="h-9 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white">Salvar</SubmitButton>
        </ActionForm>
        <div className="mt-2 flex items-center gap-2">
          <form action={moveMediaAction}>
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="dir" value="up" />
            <button className={small} aria-label="Mover para cima">↑</button>
          </form>
          <form action={moveMediaAction}>
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="dir" value="down" />
            <button className={small} aria-label="Mover para baixo">↓</button>
          </form>
          <ConfirmAction action={deleteMediaAction} label="Excluir" danger confirmLabel="Excluir imagem" description="Imagens em uso não podem ser excluídas — troque-as antes onde estiverem sendo usadas." hidden={{ id: asset.id }} />
        </div>
      </div>
    </div>
  );
}
