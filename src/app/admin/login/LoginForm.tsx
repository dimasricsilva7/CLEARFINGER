"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
        <input key={state?.email ?? ""} defaultValue={state?.email ?? ""} id="email" name="email" type="email" autoComplete="username" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-[15px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-[15px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10" />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700" role="alert">{state.error}</p>}
      <button disabled={pending} className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
