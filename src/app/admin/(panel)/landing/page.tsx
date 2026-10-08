import Link from "next/link";
import { Badge, PageHeader } from "@/components/admin/ui";
import { Table } from "@/components/admin/Table";
import { SECTION_TYPES, type SectionType } from "@/lib/domain";
import { db } from "@/lib/db";
import { formatDate } from "@/utils/format";
import { moveSection, toggleSection } from "../cms-actions";

export const metadata = { title: "Landing page" };

export default async function LandingCmsPage() {
  const sections = await db.landingSection.findMany({ orderBy: { sortOrder: "asc" } });
  const small = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50";
  return (
    <div>
      <PageHeader
        title="Landing page"
        description="Blocos da página inicial: ative, reordene e edite cada seção. Header, rodapé e CTA fixo ficam em Configurações → Aparência. Alterações aparecem no site na hora, sem deploy."
        actions={<Link href="/" target="_blank" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">Ver página</Link>}
      />
      <Table
        rows={sections}
        rowKey={(s) => s.key}
        columns={[
          {
            key: "o",
            label: "Ordem",
            render: (s) => (
              <span className="flex items-center gap-1">
                <span className="w-6 text-xs text-slate-400">{s.sortOrder}</span>
                <form action={moveSection}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="up" /><button className={small} aria-label="Subir">↑</button></form>
                <form action={moveSection}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="down" /><button className={small} aria-label="Descer">↓</button></form>
              </span>
            ),
          },
          { key: "l", label: "Seção", render: (s) => <Link href={`/admin/landing/${s.key}`} className="font-semibold hover:underline">{s.label}</Link> },
          { key: "t", label: "Tipo", render: (s) => SECTION_TYPES[s.type as SectionType] ?? s.type },
          { key: "ti", label: "Título", render: (s) => <span className="block max-w-[280px] truncate text-slate-600">{s.title ?? "—"}</span> },
          {
            key: "a",
            label: "Status",
            render: (s) => (
              <span className="flex items-center gap-2">
                {s.active ? <Badge tone="green">ativa</Badge> : <Badge>oculta</Badge>}
                {s.type === "demo" && !s.videoUrl && !s.imageUrl && !(s.config as Record<string, string>)?.beforeUrl && <Badge tone="amber">sem vídeo/imagens reais — não aparece</Badge>}
                {s.type === "testimonials" && <Badge tone="blue">só com depoimentos ativos</Badge>}
                {s.type === "faq" && <Badge tone="blue">conteúdo em FAQ</Badge>}
                {s.type === "offers" && <Badge tone="blue">kits em Ofertas</Badge>}
              </span>
            ),
          },
          { key: "u", label: "Atualizada", render: (s) => formatDate(s.updatedAt, true) },
          {
            key: "x",
            label: "",
            render: (s) => (
              <span className="flex gap-1">
                <Link href={`/admin/landing/${s.key}`} className={small}>Editar</Link>
                <form action={toggleSection}><input type="hidden" name="key" value={s.key} /><button className={small}>{s.active ? "Ocultar" : "Mostrar"}</button></form>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
