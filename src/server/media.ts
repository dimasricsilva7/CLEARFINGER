import "server-only";
import dns from "dns/promises";
import net from "net";
import sharp from "sharp";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";

/**
 * Armazenamento de imagens no próprio Postgres, servidas por /media/[id].webp
 * com cache imutável de CDN (a Vercel guarda a resposta na borda — o banco só
 * é consultado na primeira visita de cada imagem). Independe do Vercel Blob.
 */

export class MediaError extends Error {}

const MAX_INPUT = 15 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|jpg|png|webp|avif|gif|heic|heif)$/i;

export async function processImage(input: Buffer) {
  try {
    const img = sharp(input, { failOn: "error", animated: false }).rotate();
    const out = await img
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height, size: out.data.length, mimeType: "image/webp" };
  } catch {
    throw new MediaError("Não foi possível ler a imagem. Use JPG, PNG, WEBP ou AVIF.");
  }
}

type Meta = { name: string; alt?: string; category?: string; sourceUrl?: string | null };

export async function saveImageBuffer(input: Buffer, meta: Meta) {
  if (input.length > MAX_INPUT) throw new MediaError("Imagem acima de 15 MB.");
  const img = await processImage(input);
  const id = `m${randomToken(12)}`;
  return db.mediaAsset.create({
    data: {
      id,
      name: meta.name.slice(0, 120) || "imagem",
      url: `/media/${id}.webp`,
      alt: (meta.alt ?? "").slice(0, 200),
      category: meta.category ?? "OUTROS",
      mimeType: img.mimeType,
      size: img.size,
      width: img.width,
      height: img.height,
      storage: "db",
      data: img.data,
      sourceUrl: meta.sourceUrl ?? null,
    },
    select: { id: true, name: true, url: true, alt: true, category: true },
  });
}

// ───────────── Importação por link (com proteção SSRF) ─────────────

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new MediaError("Link inválido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new MediaError("Use um link http(s).");
  if (url.username || url.password) throw new MediaError("Link inválido.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new MediaError("Link não permitido.");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) throw new MediaError("Não foi possível acessar esse endereço.");
  if (addrs.some(isPrivateIp)) throw new MediaError("Link não permitido.");
  return url;
}

/** Baixa a imagem do link (até 3 redirecionamentos, 15 s, 15 MB) e guarda na loja. */
export async function importImageFromUrl(raw: string, meta: Omit<Meta, "sourceUrl" | "name"> & { name?: string }) {
  let url = await assertPublicUrl(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "image/avif,image/webp,image/*,*/*;q=0.5" },
        cache: "no-store",
      });
    } catch {
      throw new MediaError("Não foi possível baixar a imagem desse link (tempo esgotado ou site indisponível).");
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new MediaError(`O site respondeu ${res?.status ?? "erro"} ao baixar a imagem. Tente baixar o arquivo e enviar pelo computador.`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (type && !ACCEPTED.test(type) && type !== "application/octet-stream" && type !== "binary/octet-stream") {
    throw new MediaError("Esse link não aponta para uma imagem (abra a imagem em nova aba e copie o endereço dela).");
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_INPUT) throw new MediaError("Imagem acima de 15 MB.");

  const reader = res.body?.getReader();
  if (!reader) throw new MediaError("Resposta vazia.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INPUT) {
      await reader.cancel();
      throw new MediaError("Imagem acima de 15 MB.");
    }
    chunks.push(value);
  }
  const name = meta.name || decodeURIComponent(url.pathname.split("/").pop() || "imagem").replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "imagem";
  return saveImageBuffer(Buffer.concat(chunks), { ...meta, name, sourceUrl: url.toString().slice(0, 1000) });
}

/** Usa o link externo diretamente (sem baixar). A imagem depende do site de origem continuar no ar. */
export async function linkExternalImage(raw: string, meta: Omit<Meta, "sourceUrl" | "name"> & { name?: string }) {
  const url = await assertPublicUrl(raw);
  if (url.protocol !== "https:") throw new MediaError("Para usar o link direto, ele precisa ser https.");
  return db.mediaAsset.create({
    data: {
      name: (meta.name || url.pathname.split("/").pop() || "imagem externa").slice(0, 120),
      url: url.toString().slice(0, 1000),
      alt: (meta.alt ?? "").slice(0, 200),
      category: meta.category ?? "OUTROS",
      storage: "link",
      sourceUrl: url.toString().slice(0, 1000),
    },
    select: { id: true, name: true, url: true, alt: true, category: true },
  });
}
