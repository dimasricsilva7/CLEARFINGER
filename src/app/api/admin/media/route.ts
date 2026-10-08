import { NextResponse, type NextRequest } from "next/server";
import { isMediaCategory } from "@/utils/media";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cat = req.nextUrl.searchParams.get("category");
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 80);
  const assets = await db.mediaAsset.findMany({
    where: {
      active: true,
      ...(isMediaCategory(cat) ? { category: cat } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 120,
    select: { id: true, name: true, url: true, alt: true, category: true },
  });
  return NextResponse.json({ assets });
}
