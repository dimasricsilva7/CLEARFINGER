"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { btnDanger, btnPrimary, btnSecondary } from "./ui";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | undefined;

export function SubmitButton({ children, className = btnPrimary, pendingText = "Salvando…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionResult }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>;
  if (state.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{state.message ?? "Salvo com sucesso."}</p>;
  return null;
}

/** Formulário de Server Action com feedback de sucesso/erro. */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  confirm,
  resetOnSuccess,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <ActionMessage state={state} />
    </form>
  );
}

/** Botão com etapa de confirmação explícita (ações sensíveis). */
export function ConfirmAction({
  action,
  label,
  confirmLabel = "Confirmar",
  description,
  danger,
  hidden,
  children,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  label: string;
  confirmLabel?: string;
  description?: string;
  danger?: boolean;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  return (
    <div>
      <button type="button" className={danger ? btnDanger : btnSecondary} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ActionMessage state={state} />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <form action={formAction} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <p className="text-base font-semibold text-slate-900">{label}</p>
            {description && <p className="text-sm text-slate-600">{description}</p>}
            {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {children}
            <ActionMessage state={state} />
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <SubmitButton className={danger ? btnDanger : btnPrimary} pendingText="Processando…">
                {confirmLabel}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
