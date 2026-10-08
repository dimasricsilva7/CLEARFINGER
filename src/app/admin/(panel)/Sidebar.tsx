"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "../login/actions";

const GROUPS: { title: string; items: { href: string; label: string; owner?: boolean }[] }[] = [
  {
    title: "Visão geral",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/funil", label: "Funil" },
      { href: "/admin/metricas", label: "Métricas" },
      { href: "/admin/tracking", label: "Tracking e online" },
    ],
  },
  {
    title: "Vendas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos" },
      { href: "/admin/clientes", label: "Clientes" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos" },
      { href: "/admin/ofertas", label: "Ofertas e kits" },
      { href: "/admin/order-bumps", label: "Order bumps" },
      { href: "/admin/imagens", label: "Imagens" },
    ],
  },
  {
    title: "Conteúdo (CMS)",
    items: [
      { href: "/admin/landing", label: "Landing page" },
      { href: "/admin/depoimentos", label: "Depoimentos" },
      { href: "/admin/faq", label: "FAQ" },
    ],
  },
  {
    title: "Pagamentos",
    items: [
      { href: "/admin/pagamentos", label: "PIX" },
      { href: "/admin/pagamentos/crediario", label: "Crediário" },
      { href: "/admin/webhooks", label: "Webhooks" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações" },
      { href: "/admin/auditoria", label: "Auditoria (logs)" },
      { href: "/admin/usuarios", label: "Usuários" },
    ],
  },
];

export function Sidebar({ name, email, role }: { name: string; email: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const all = GROUPS.flatMap((g) => g.items);
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || (pathname.startsWith(`${href}/`) && !all.some((n) => n.href !== href && n.href.startsWith(href) && pathname.startsWith(n.href)));

  const nav = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Admin">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>
          {g.items
            .filter((i) => !i.owner || role === "OWNER")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-1.5 text-sm transition ${isActive(item.href) ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                {item.label}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-medium text-slate-900">{name}</p>
      <p className="truncate text-xs text-slate-500">{email} · {role}</p>
      <div className="mt-3 flex gap-2">
        <Link href="/" target="_blank" className="flex-1 rounded-lg border border-slate-300 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50">
          Ver loja
        </Link>
        <form action={logoutAction} className="flex-1">
          <button className="w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Sair</button>
        </form>
      </div>
    </div>
  );
  const brand = <span className="text-base font-extrabold uppercase tracking-tight">Clear<span className="text-[#1F6FD1]">finger</span></span>;

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 hover:bg-slate-100" aria-label="Abrir menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        {brand}
        <span className="w-8" />
      </div>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          {brand}
          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">ADMIN</span>
        </div>
        {nav}
        {footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center border-b border-slate-200 px-5">{brand}</div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
