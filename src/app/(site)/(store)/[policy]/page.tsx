import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POLICY_PAGES } from "@/lib/settings-defaults";
import { getSettings } from "@/server/settings";

type Props = { params: Promise<{ policy: string }> };

export function generateStaticParams() {
  return Object.keys(POLICY_PAGES).map((policy) => ({ policy }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = POLICY_PAGES[(await params).policy as keyof typeof POLICY_PAGES];
  return page ? { title: page.title } : {};
}

/** Políticas editáveis em Configurações → Políticas. */
export default async function PolicyPage({ params }: Props) {
  const page = POLICY_PAGES[(await params).policy as keyof typeof POLICY_PAGES];
  if (!page) notFound();
  const s = await getSettings();
  const text = (s[page.key] ?? "").replace(/^\[PREENCHER\]\s*/gm, "");
  return (
    <article className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="h-section">{page.title}</h1>
      <div className="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{text}</div>
    </article>
  );
}
