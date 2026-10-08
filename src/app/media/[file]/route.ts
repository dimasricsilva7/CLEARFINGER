import { db } from "@/lib/db";

/**
 * Serve imagens guardadas no banco. O conteúdo de um id nunca muda (cada
 * upload gera um id novo), então o cache é imutável e a CDN da Vercel
 * responde as próximas visitas sem tocar no banco.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.[a-z0-9]+$/i, "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { data: true, mimeType: true, storage: true } });
  if (!asset || asset.storage !== "db" || !asset.data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
