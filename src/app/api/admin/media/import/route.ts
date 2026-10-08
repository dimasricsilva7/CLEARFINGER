import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MEDIA_CATEGORIES } from "@/utils/media";
import { getCurrentAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { MediaError, importImageFromUrl, linkExternalImage } from "@/server/media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  url: z.string().trim().min(8).max(2000),
  mode: z.enum(["download", "link"]).default("download"),
  category: z.enum(MEDIA_CATEGORIES).default("OUTROS"),
  alt: z.string().max(200).optional(),
  name: z.string().max(120).optional(),
});

/** Adiciona imagem por link: baixa e guarda na loja (padrão) ou usa o link direto. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (!rateLimit(`import:${admin.id}`, 30, 60_000)) return NextResponse.json({ error: "Muitas importações seguidas. Aguarde um minuto." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cole um link de imagem válido." }, { status: 422 });
  const { url, mode, ...meta } = parsed.data;

  try {
    const asset = mode === "link" ? await linkExternalImage(url, meta) : await importImageFromUrl(url, meta);
    await audit(admin.id, "media_imported", "media", asset.id, { summary: `Imagem adicionada por link (${mode})`, details: { mode, source: url.slice(0, 200) } });
    return NextResponse.json({ asset });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[media-import] falha", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível importar essa imagem." }, { status: 500 });
  }
}
