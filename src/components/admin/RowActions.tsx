"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "./client";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

const small = "rounded-md border px-2 py-1 text-xs font-semibold transition disabled:opacity-50";

/** Botões compactos para linhas de tabela: ação simples (ex.: reenviar e-mail) e exclusão com confirmação. */
export function RowActions({
  id,
  primary,
  primaryLabel = "Reenviar e-mail",
  onDelete,
  deleteLabel = "Excluir",
  deleteConfirm,
}: {
  id: string;
  primary?: Action;
  primaryLabel?: string;
  onDelete?: Action;
  deleteLabel?: string;
  deleteConfirm?: string;
}) {
  const [pState, pAction, pPending] = useActionState(primary ?? (async () => undefined), undefined);
  const [dState, dAction, dPending] = useActionState(onDelete ?? (async () => undefined), undefined);
  const [msg, setMsg] = useState<ActionResult>(undefined);
  useEffect(() => setMsg(pState), [pState]);
  useEffect(() => setMsg(dState), [dState]);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(undefined), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="flex min-w-[150px] flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {primary && (
          <form action={pAction}>
            <input type="hidden" name="id" value={id} />
            <button disabled={pPending} className={`${small} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
              {pPending ? "Enviando…" : primaryLabel}
            </button>
          </form>
        )}
        {onDelete && (
          <form
            action={dAction}
            onSubmit={(e) => {
              if (!window.confirm(deleteConfirm ?? "Excluir definitivamente?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button disabled={dPending} className={`${small} border-red-200 bg-white text-red-700 hover:bg-red-50`}>
              {dPending ? "Excluindo…" : deleteLabel}
            </button>
          </form>
        )}
      </div>
      {msg && (msg.error || msg.message) && <p className={`max-w-[220px] text-[11px] leading-tight ${msg.error ? "text-red-600" : "text-emerald-700"}`}>{msg.error ?? msg.message}</p>}
    </div>
  );
}
