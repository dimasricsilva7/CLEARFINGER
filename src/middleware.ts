import { NextResponse, type NextRequest } from "next/server";
import { SCANNER_PATH } from "@/lib/security";

const VID = "cf_vid";

function newVisitorId() {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("") + "v";
}

/**
 * 1. Admin: sem cookie de sessão → login (páginas) ou 401 (API). A validação real
 *    (hash no banco, expiração) acontece no servidor via requireAdmin().
 * 2. Loja: garante o visitor_id já na primeira requisição, para que o servidor
 *    associe todas as sessões e o pedido ao mesmo visitante.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Varredura de vulnerabilidades (WordPress, .env, .git…): 404 na borda, sem tocar no app
  if (SCANNER_PATH.test(pathname)) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });

  if (pathname.startsWith("/api/admin")) {
    if (!req.cookies.get("cf_admin")?.value) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin")) {
    if (pathname !== "/admin/login" && !req.cookies.get("cf_admin")?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (req.cookies.get(VID)?.value) return NextResponse.next();
  const vid = newVisitorId();
  const headers = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  headers.set("cookie", cookie ? `${cookie}; ${VID}=${vid}` : `${VID}=${vid}`);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(VID, vid, { maxAge: 365 * 86_400, path: "/", sameSite: "lax", secure: req.nextUrl.protocol === "https:" });
  return res;
}

export const config = {
  matcher: ["/((?!api/|_next/|media/|brand/|favicon|icon|robots.txt|sitemap.xml).*)", "/api/admin/:path*"],
};
