import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "./Sidebar";

export const metadata: Metadata = { title: { default: "Admin", template: "%s — Admin CLEARFINGER" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-ui min-h-screen bg-slate-50 font-sans text-slate-900 lg:flex">
      <Sidebar name={admin.name} email={admin.email} role={admin.role} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
