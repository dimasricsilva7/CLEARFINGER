"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "./ui";

import { CATEGORY_LABEL, MEDIA_CATEGORIES } from "@/utils/media";

export { CATEGORY_LABEL, MEDIA_CATEGORIES };

export type Asset = { id: string; name: string; url: string; alt: string; category: string };

/**
 * Reduz (máx. 2400px) e converte para WebP no navegador antes do envio, para
 * caber no limite de 4,5 MB das funções. Se o navegador não conseguir ler o
 * formato (ex.: HEIC), envia o arquivo original e o servidor converte.
 */
export async function prepareImage(file: File, maxSide = 2400): Promise<{ file: File; width?: number; height?: number; name: string }> {
  const name = file.name.replace(/\.[^.]+$/, "") || "imagem";
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    let quality = 0.86;
    let blob: Blob | null = null;
    do {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
      quality -= 0.1;
    } while (blob && blob.size > 3.8 * 1024 * 1024 && quality > 0.4);
    if (blob && blob.type === "image/webp") return { file: new File([blob], `${name}.webp`, { type: "image/webp" }), width, height, name };
  } catch {
    /* segue com o original */
  }
  return { file, name };
}

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (data?.error) return data.error;
  if (res.status === 413) return "Arquivo grande demais para envio. Use uma imagem menor que 4 MB.";
  if (res.status === 401) return "Sua sessão expirou. Entre novamente no admin.";
  return `${fallback} (erro ${res.status}).`;
}

export async function uploadImage(file: File, meta: { category?: string; alt?: string } = {}): Promise<Asset> {
  const prepared = await prepareImage(file);
  if (prepared.file.size > 4.4 * 1024 * 1024) throw new Error(`"${file.name}" tem mais de 4 MB e não pôde ser reduzida no navegador. Converta para JPG/WEBP e tente de novo.`);
  const fd = new FormData();
  fd.append("file", prepared.file);
  fd.append("name", prepared.name);
  Object.entries(meta).forEach(([k, v]) => v && fd.append(k, v));
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await readError(res, "Falha no envio"));
  const data = (await res.json()) as { asset: Asset };
  return data.asset;
}

export async function importImageByLink(url: string, mode: "download" | "link", meta: { category?: string; alt?: string } = {}): Promise<Asset> {
  const res = await fetch("/api/admin/media/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, mode, ...meta }),
  });
  if (!res.ok) throw new Error(await readError(res, "Falha ao importar"));
  return ((await res.json()) as { asset: Asset }).asset;
}

export function UploadButton({ category = "OUTROS", onUploaded, label = "Enviar do computador", multiple = false }: { category?: string; onUploaded: (a: Asset) => void; label?: string; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif"
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setError(null);
          const errors: string[] = [];
          for (const [i, f] of files.entries()) {
            setBusy(files.length > 1 ? `Enviando ${i + 1}/${files.length}…` : "Enviando…");
            try {
              onUploaded(await uploadImage(f, { category }));
            } catch (err) {
              errors.push(err instanceof Error ? err.message : `Falha em ${f.name}`);
            }
          }
          setBusy(null);
          if (errors.length) setError(errors.join(" "));
          if (ref.current) ref.current.value = "";
        }}
      />
      <button type="button" className={btnPrimary} onClick={() => ref.current?.click()} disabled={Boolean(busy)}>
        {busy ?? label}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Campo para adicionar imagem por link (baixar para a loja ou usar o link direto). */
export function LinkImport({ category = "OUTROS", onImported }: { category?: string; onImported: (a: Asset) => void }) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"download" | "link">("download");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onImported(await importImageByLink(url.trim(), mode, { category }));
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Cole o link da imagem (https://…)"
          className={`${inputCls} flex-1`}
          inputMode="url"
        />
        <select value={mode} onChange={(e) => setMode(e.target.value as "download" | "link")} className={`${inputCls} sm:!w-56`} aria-label="Como usar o link">
          <option value="download">Baixar para a loja (recomendado)</option>
          <option value="link">Usar o link direto</option>
        </select>
        <button type="button" className={btnPrimary} onClick={submit} disabled={busy || !url.trim()}>
          {busy ? "Importando…" : "Adicionar por link"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-[11px] text-slate-500">&quot;Baixar&quot; guarda uma cópia otimizada na loja (não quebra se o site de origem sair do ar). Use o endereço da imagem em si (clique com o botão direito → copiar endereço da imagem).</p>
    </div>
  );
}

/** Modal para escolher uma imagem da biblioteca, enviar do computador (inclusive arrastando) ou adicionar por link. */
export function MediaModal({ open, onClose, onSelect, category }: { open: boolean; onClose: () => void; onSelect: (a: Asset) => void; category?: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("category", filter);
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/media?${params.toString()}`);
    const data = (await res.json().catch(() => ({ assets: [] }))) as { assets: Asset[] };
    setAssets(data.assets ?? []);
  }, [filter, q]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  if (!open) return null;

  // Uma imagem nova (enviada ou importada) já fica selecionada no campo.
  const pick = (a: Asset) => {
    onSelect(a);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div
        className={`flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl ${dragging ? "ring-4 ring-blue-400" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
          if (!file) return;
          setDropMsg("Enviando…");
          try {
            pick(await uploadImage(file, { category: category || "OUTROS" }));
          } catch (err) {
            setDropMsg(err instanceof Error ? err.message : "Falha no envio");
          }
        }}
      >
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto font-semibold">Biblioteca de imagens</p>
            <UploadButton category={category || "OUTROS"} onUploaded={pick} />
            <button type="button" className={btnSecondary} onClick={onClose}>
              Fechar
            </button>
          </div>
          <LinkImport category={category || "OUTROS"} onImported={pick} />
          <p className="text-[11px] text-slate-500">Dica: você também pode arrastar uma imagem do computador para esta janela.</p>
          {dropMsg && <p className="text-xs text-slate-700">{dropMsg}</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na biblioteca" className={`${inputCls} !w-48`} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-44`}>
              <option value="">Todas as categorias</option>
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-5">
          {assets.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-400">Nenhuma imagem ainda. Envie do computador, arraste aqui ou cole um link acima.</p>}
          {assets.map((a) => (
            <button key={a.id} type="button" onClick={() => pick(a)} className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.alt} className="aspect-square w-full object-cover" loading="lazy" />
              <span className="block truncate px-2 py-1 text-xs text-slate-600">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Campo de imagem com as DUAS formas de envio, direto no formulário:
 *  1. "Enviar arquivo" — escolhe (ou arrasta) uma imagem do computador; ela é otimizada e guardada no site.
 *  2. "Usar URL"       — cola o link https da imagem; guarda uma cópia no site (recomendado) ou usa o link direto.
 * Também abre a biblioteca para reaproveitar imagens já enviadas. A URL escolhida vai num input hidden.
 */
export function ImageField({ name, label, defaultValue = "", category, hint, onChange }: { name: string; label: string; defaultValue?: string; category?: string; hint?: string; onChange?: (url: string) => void }) {
  const [url, setUrl] = useState(defaultValue);
  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current) {
      changed.current = true;
      return;
    }
    onChange?.(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  const [open, setOpen] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [link, setLink] = useState("");
  const [copy, setCopy] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cat = category || "OUTROS";

  const sendFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem (JPG, PNG, WEBP, AVIF).");
    setError(null);
    setBusy("Enviando arquivo…");
    try {
      setUrl((await uploadImage(file, { category: cat })).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applyLink = async () => {
    const v = link.trim();
    if (!/^https?:\/\//i.test(v)) return setError("Cole um link que comece com https://");
    setError(null);
    setBusy(copy ? "Baixando a imagem…" : "Conferindo o link…");
    try {
      setUrl((await importImageByLink(v, copy ? "download" : "link", { category: cat })).url);
      setLink("");
      setShowUrl(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível usar esse link");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        sendFile(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/")));
      }}
      className={`rounded-lg ${drag ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
    >
      <label className={labelCls}>{label}</label>
      {name && <input type="hidden" name={name} value={url} />}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif" className="hidden" onChange={(e) => sendFile(e.target.files?.[0])} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-contain" onError={() => setError("A imagem desse endereço não carregou. Confira o link.")} />
          ) : (
            <span className="px-2 text-center text-xs text-slate-400">Sem imagem · arraste aqui</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
              Enviar arquivo
            </button>
            <button type="button" className={btnSecondary} onClick={() => setShowUrl((v) => !v)} disabled={Boolean(busy)} aria-expanded={showUrl}>
              Usar URL
            </button>
            <button type="button" className={btnSecondary} onClick={() => setOpen(true)} disabled={Boolean(busy)}>
              Biblioteca
            </button>
            {url && (
              <button type="button" className={btnSecondary} onClick={() => setUrl("")}>
                Remover
              </button>
            )}
          </div>
          {showUrl && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyLink();
                    }
                  }}
                  placeholder="https://exemplo.com/imagem.jpg"
                  inputMode="url"
                  className={`${inputCls} flex-1`}
                  aria-label="URL da imagem"
                />
                <button type="button" className={btnPrimary} onClick={applyLink} disabled={Boolean(busy) || !link.trim()}>
                  Usar esta URL
                </button>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="mt-0.5 h-4 w-4" />
                Guardar uma cópia otimizada no site (recomendado — não quebra se o site de origem sair do ar). Desmarque para usar o link direto.
              </label>
            </div>
          )}
          {busy && <p className="text-xs font-semibold text-slate-700">{busy}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {url && !busy && (
            <p className="truncate text-[11px] text-slate-500" title={url}>
              {url.startsWith("/") ? "Imagem guardada no site" : url} · lembre de salvar o formulário
            </p>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <MediaModal open={open} onClose={() => setOpen(false)} onSelect={(a) => setUrl(a.url)} category={category} />
    </div>
  );
}
