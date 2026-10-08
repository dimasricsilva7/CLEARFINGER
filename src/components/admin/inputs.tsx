"use client";

import { useState } from "react";
import { inputCls, textareaCls, btnSecondary } from "./ui";
import { ICONS } from "@/lib/domain";

export { ImageField } from "./media";

/** Campo de vídeo: link MP4 (https), YouTube ou Vimeo, com prévia. */
export function VideoInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const embed = /youtu.?be/i.test(url) ? "YouTube" : /vimeo.com/i.test(url) ? "Vimeo" : null;
  return (
    <div>
      <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex gap-2">
        <input name={name} value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://… (MP4, YouTube Shorts ou Vimeo)" className={inputCls} />
        {url && (
          <button type="button" onClick={() => setUrl("")} className={`${btnSecondary} px-3`} aria-label="Limpar">
            ✕
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Vídeo vertical (9:16). Para MP4, use um link público https (ex.: hospedagem de vídeo da sua conta). Use somente vídeos reais do produto.</p>
      {url && embed && <p className="mt-1 text-xs font-semibold text-emerald-700">Link de {embed} reconhecido — o vídeo será incorporado.</p>}
      {url && !embed && /^https:/.test(url) && <video src={url} className="mt-2 h-40 rounded-lg border border-slate-200" controls preload="metadata" />}
    </div>
  );
}

export type ListField = { key: string; label: string; type?: "text" | "textarea" | "select" | "checkbox" | "media" | "number"; options?: readonly string[]; width?: string; placeholder?: string };

/**
 * Editor de listas JSON (composição do kit, especificações, passos, benefícios…).
 * Serializa em um <input hidden name=...> para a Server Action.
 */
export function ListEditor<T extends Record<string, unknown>>({ name, fields, defaultValue, addLabel = "Adicionar item", newItem, idKey }: { name: string; fields: ListField[]; defaultValue: T[]; addLabel?: string; newItem: () => T; idKey?: string }) {
  const [items, setItems] = useState<T[]>(defaultValue);
  const update = (i: number, key: string, value: unknown) => setItems((list) => list.map((it, j) => (j === i ? { ...it, [key]: value } : it)));
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      {items.map((it, i) => (
        <div key={idKey ? String(it[idKey]) : i} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {fields.map((f) => (
            <div key={f.key} className={f.width ?? "min-w-[140px] flex-1"}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase text-slate-400">{f.label}</p>
              {f.type === "textarea" ? (
                <textarea value={String(it[f.key] ?? "")} onChange={(e) => update(i, f.key, e.target.value)} rows={2} className={textareaCls} />
              ) : f.type === "select" ? (
                <select value={String(it[f.key] ?? "")} onChange={(e) => update(i, f.key, e.target.value)} className={inputCls}>
                  {f.options?.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "checkbox" ? (
                <input type="checkbox" checked={Boolean(it[f.key])} onChange={(e) => update(i, f.key, e.target.checked)} className="mt-2 h-5 w-5" />
              ) : f.type === "number" ? (
                <input type="number" value={String(it[f.key] ?? "")} onChange={(e) => update(i, f.key, e.target.value === "" ? null : Number(e.target.value))} className={inputCls} />
              ) : (
                <input value={String(it[f.key] ?? "")} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
              )}
            </div>
          ))}
          <div className="flex gap-1 self-end">
            <button type="button" onClick={() => move(i, -1)} className="h-10 w-8 rounded border border-slate-300 bg-white text-sm" aria-label="Subir">↑</button>
            <button type="button" onClick={() => move(i, 1)} className="h-10 w-8 rounded border border-slate-300 bg-white text-sm" aria-label="Descer">↓</button>
            <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="h-10 rounded border border-red-200 bg-white px-2 text-xs font-semibold text-red-600">Remover</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems((l) => [...l, newItem()])} className={btnSecondary}>
        + {addLabel}
      </button>
    </div>
  );
}

/** Lista simples de textos (ex.: itens de público, categorias). */
export function StringListEditor({ name, defaultValue, addLabel = "Adicionar" }: { name: string; defaultValue: string[]; addLabel?: string }) {
  return (
    <ListEditor
      name={`${name}__obj`}
      fields={[{ key: "v", label: "Texto" }]}
      defaultValue={defaultValue.map((v) => ({ v }))}
      newItem={() => ({ v: "" })}
      addLabel={addLabel}
    />
  );
}


// ───────────── Editores prontos (a função newItem fica no cliente) ─────────────




export function SpecsEditor({ name, defaultValue }: { name: string; defaultValue: Record<string, unknown>[] }) {
  return <ListEditor name={name} defaultValue={defaultValue} addLabel="Adicionar especificação" newItem={() => ({ label: "", value: "" })} fields={[{ key: "label", label: "Nome", placeholder: "Tamanho das peças" }, { key: "value", label: "Valor" }]} />;
}


export function IconItemsEditor({ name, defaultValue }: { name: string; defaultValue: Record<string, unknown>[] }) {
  return (
    <ListEditor
      name={name}
      defaultValue={defaultValue}
      addLabel="Adicionar item"
      newItem={() => ({ icon: "check", title: "", text: "" })}
      fields={[{ key: "icon", label: "Ícone", type: "select", options: ICONS, width: "w-32" }, { key: "title", label: "Título" }, { key: "text", label: "Texto", type: "textarea" }]}
    />
  );
}

export function StepsEditor({ name, defaultValue }: { name: string; defaultValue: Record<string, unknown>[] }) {
  return <ListEditor name={name} defaultValue={defaultValue} addLabel="Adicionar passo" newItem={() => ({ title: "", text: "" })} fields={[{ key: "title", label: "Título" }, { key: "text", label: "Texto", type: "textarea" }]} />;
}


