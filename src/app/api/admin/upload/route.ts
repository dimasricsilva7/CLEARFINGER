import { NextResponse, type NextRequest } from "next/server";
import { isMediaCategory } from "@/utils/media";
import { getCurrentAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/request";
import { MediaError, saveImageBuffer } from "@/server/media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX = 4.4 * 1024 * 1024; // limite de corpo de função da Vercel (~4,5 MB) — o navegador já reduz antes
const TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"];

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WEBP ou AVIF." }, { status: 422 });
  if (file.size > MAX) return NextResponse.json({ error: "Arquivo muito grande (máx. 4 MB após compressão)." }, { status: 422 });

  const rawCategory = fd?.get("category");
  const category = isMediaCategory(rawCategory) ? rawCategory : "OUTROS";

  try {
    const asset = await saveImageBuffer(Buffer.from(await file.arrayBuffer()), {
      name: String(fd?.get("name") || file.name.replace(/\.[^.]+$/, "")),
      alt: String(fd?.get("alt") ?? ""),
      category,
    });
    await audit(admin.id, "media_uploaded", "media", asset.id, { summary: `Imagem enviada: ${asset.name}`, details: { category } });
    return NextResponse.json({ asset });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[upload] falha", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível salvar a imagem. Tente novamente." }, { status: 500 });
  }
}
