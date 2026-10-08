import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Field, PageHeader, inputCls, textareaCls, btnSecondary } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { IconItemsEditor, ImageField, StepsEditor, StringListEditor, VideoInput } from "@/components/admin/inputs";
import { SECTION_TYPES, type SectionType } from "@/lib/domain";
import { db } from "@/lib/db";
import { saveSection } from "../../cms-actions";

export const metadata = { title: "Editar seção" };

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Quais campos comuns cada tipo de seção usa (evita campos que não aparecem no site). */
const USES: Record<string, { subtitle?: boolean; body?: boolean; image?: string; video?: boolean; cta?: boolean }> = {
  hero: { subtitle: true, image: "Imagem do produto (vazio = imagem principal do produto)", cta: true },
  pain: { subtitle: true, body: true, image: "Foto da seção (pessoa/mãos — use fotos com licença de uso)" },
  solution: { body: true, image: "Imagem (vazio = imagem secundária/principal do produto)", cta: true },
  how_it_works: { subtitle: true },
  demo: { subtitle: true, image: "Imagem única de demonstração (opcional)", video: true },
  benefits: { subtitle: true },
  testimonials: { subtitle: true },
  offers: { subtitle: true, cta: true },
  faq: { subtitle: true },
  trust: { subtitle: true },
  final_cta: { subtitle: true, image: "Imagem (vazio = imagem principal do produto)", cta: true },
};

export default async function EditSectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const section = await db.landingSection.findUnique({ where: { key } });
  if (!section) notFound();
  const c = (section.config ?? {}) as Record<string, unknown>;
  const t = section.type;
  const use = USES[t] ?? { subtitle: true, body: true, cta: true };

  return (
    <div>
      <PageHeader
        title={section.label}
        description={`Tipo: ${SECTION_TYPES[t as SectionType] ?? t}`}
        actions={<><Link href="/admin/landing" className={btnSecondary}>Voltar</Link><Link href="/" target="_blank" className={btnSecondary}>Ver página</Link></>}
      />
      <ActionForm action={saveSection} className="space-y-6">
        <input type="hidden" name="key" value={section.key} />
        <Card title="Conteúdo">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" name="active" defaultChecked={section.active} className="h-4 w-4" /> Seção visível na landing</label>
            <Field label="Nome interno"><input name="label" defaultValue={section.label} className={inputCls} /></Field>
            <Field label="Fundo da seção" hint="Automático alterna as cores para separar bem as seções">
              <select name="cfg_tone" defaultValue={s(c.tone) || "auto"} className={inputCls}>
                <option value="auto">Automático</option>
                <option value="white">Branco</option>
                <option value="mist">Cinza-azulado claro</option>
                <option value="navy">Azul-marinho</option>
              </select>
            </Field>
            {t !== "hero" && <Field label="Texto pequeno acima do título" className="md:col-span-2" hint="Vazio = padrão da seção"><input name="cfg_eyebrow" defaultValue={s(c.eyebrow)} className={inputCls} /></Field>}
            <Field label={t === "hero" ? "Headline" : "Título"} className="md:col-span-2"><input name="title" defaultValue={section.title ?? ""} className={inputCls} /></Field>
            {use.subtitle && <Field label={t === "hero" ? "Subheadline" : "Subtítulo"} className="md:col-span-2"><textarea name="subtitle" rows={2} defaultValue={section.subtitle ?? ""} className={textareaCls} /></Field>}
            {use.body && <Field label="Texto" className="md:col-span-2" hint="Parágrafos separados por uma linha em branco."><textarea name="body" rows={6} defaultValue={section.body ?? ""} className={textareaCls} /></Field>}
            {use.cta && (
              <>
                <Field label={t === "offers" ? "Texto do botão dos kits" : "Texto do botão (CTA)"}><input name="ctaLabel" defaultValue={section.ctaLabel ?? ""} className={inputCls} /></Field>
                {t !== "offers" && <Field label="Destino do botão" hint="#ofertas, #faq, #como-funciona…"><input name="ctaTarget" defaultValue={section.ctaTarget ?? ""} className={inputCls} /></Field>}
              </>
            )}
            {use.image && <div className="md:col-span-2"><ImageField name="imageUrl" label={use.image} defaultValue={section.imageUrl ?? ""} category={t === "demo" ? "DEMONSTRACAO" : "HERO"} /></div>}
            {use.video && <div className="md:col-span-2"><VideoInput name="videoUrl" label="Vídeo vertical de demonstração" defaultValue={section.videoUrl} /></div>}
          </div>
        </Card>

        {["hero", "pain", "solution", "how_it_works", "demo", "benefits", "trust"].includes(t) && (
          <Card title="Configuração da seção">
            <div className="grid gap-4 md:grid-cols-2">
              {t === "hero" && (
                <>
                  <Field label="Texto acima da headline" className="md:col-span-2"><input name="cfg_eyebrow" defaultValue={s(c.eyebrow)} className={inputCls} /></Field>
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Selos de segurança (até 4) — somente informações verdadeiras</p>
                    <StringListEditor name="cfg_badges" defaultValue={arr<string>(c.badges)} addLabel="Adicionar selo" />
                  </div>
                  <p className="text-xs text-slate-500 md:col-span-2">O preço exibido vem automaticamente da oferta mais barata (Ofertas). O texto do crediário usa as configurações de Pagamentos → Crediário.</p>
                </>
              )}
              {t === "pain" && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Situações de identificação</p>
                  <StringListEditor name="cfg_items" defaultValue={arr<string>(c.items)} addLabel="Adicionar situação" />
                </div>
              )}
              {t === "solution" && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Diferenciais (lista com check)</p>
                  <StringListEditor name="cfg_points" defaultValue={arr<string>(c.points)} addLabel="Adicionar diferencial" />
                </div>
              )}
              {t === "how_it_works" && (
                <>
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Passos (01, 02, 03…) — use as instruções reais de uso</p>
                    <StepsEditor name="cfg_steps" defaultValue={arr(c.steps)} />
                  </div>
                  <Field label="Observação" className="md:col-span-2"><input name="cfg_note" defaultValue={s(c.note)} className={inputCls} /></Field>
                </>
              )}
              {t === "demo" && (
                <>
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">Use somente fotos e vídeos reais do produto. Nunca publique antes/depois montado, gerado por IA ou de outra marca. Sem vídeo nem imagens, a seção não aparece.</p>
                  <ImageField name="cfg_beforeUrl" label="Antes" defaultValue={s(c.beforeUrl)} category="DEMONSTRACAO" />
                  <ImageField name="cfg_applicationUrl" label="Aplicação" defaultValue={s(c.applicationUrl)} category="DEMONSTRACAO" />
                  <ImageField name="cfg_afterUrl" label="Depois" defaultValue={s(c.afterUrl)} category="DEMONSTRACAO" />
                  <ImageField name="cfg_posterUrl" label="Capa do vídeo (MP4)" defaultValue={s(c.posterUrl)} category="DEMONSTRACAO" />
                  <Field label="Legenda" className="md:col-span-2" hint="Ex.: resultado após X dias de uso — somente se for verdade."><input name="cfg_caption" defaultValue={s(c.caption)} className={inputCls} /></Field>
                  <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm md:col-span-2">
                    <input type="checkbox" name="confirmReal" className="mt-0.5 h-4 w-4" />
                    Confirmo que as imagens de antes/depois são reais, sem montagem, e que tenho autorização para publicá-las.
                  </label>
                </>
              )}
              {(t === "benefits" || t === "trust") && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t === "benefits" ? "Benefícios" : "Selos de confiança"} — não invente certificações, prêmios ou números</p>
                  <IconItemsEditor name="cfg_items" defaultValue={arr(c.items)} />
                </div>
              )}
            </div>
          </Card>
        )}
        {t === "offers" && <p className="text-sm text-slate-600">Os kits, preços, selos e destaque são editados em <Link href="/admin/ofertas" className="font-semibold underline">Ofertas</Link>.</p>}
        {t === "faq" && <p className="text-sm text-slate-600">As perguntas são editadas em <Link href="/admin/faq" className="font-semibold underline">FAQ</Link>.</p>}
        {t === "testimonials" && <p className="text-sm text-slate-600">Os depoimentos são cadastrados em <Link href="/admin/depoimentos" className="font-semibold underline">Depoimentos</Link>.</p>}
        <SubmitButton>Salvar seção</SubmitButton>
      </ActionForm>
    </div>
  );
}
