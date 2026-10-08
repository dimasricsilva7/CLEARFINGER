import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { AdminRole, AdminUser } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { log } from "@/lib/log";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | undefined;

const RANK: Record<AdminRole, number> = { EDITOR: 1, ADMIN: 2, OWNER: 3 };

const isRedirect = (err: unknown) => (err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT") || (err as Error)?.message === "NEXT_REDIRECT";

/**
 * Executa o corpo de uma Server Action do admin: exige sessão válida e papel mínimo
 * e converte exceções em mensagem amigável. (Server Actions já têm proteção CSRF do Next.)
 * Uso: `export async function x(_: ActionResult, fd: FormData) { return withAdmin("ADMIN", async (admin) => {...}) }`
 */
export async function withAdmin(minRole: AdminRole, fn: (admin: AdminUser) => Promise<ActionResult>): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (RANK[admin.role] < RANK[minRole]) return { error: "Você não tem permissão para esta ação." };
  try {
    return await fn(admin);
  } catch (err) {
    if (isRedirect(err)) throw err;
    const message = err instanceof Error ? err.message : "Erro inesperado";
    log.error("admin", "falha em ação", { error: message });
    return { error: message.length < 200 && !/prisma|invocation|unique constraint/i.test(message) ? message : /unique constraint/i.test(message) ? "Já existe um registro com esse valor (código/slug/SKU)." : "Não foi possível salvar. Tente novamente." };
  }
}

/** Variante para <form action> simples (sem estado de retorno). */
export async function withAdminVoid(minRole: AdminRole, fn: (admin: AdminUser) => Promise<void>): Promise<void> {
  const admin = await requireAdmin();
  if (RANK[admin.role] < RANK[minRole]) throw new Error("Sem permissão");
  await fn(admin);
}

/** Invalida os caches públicos afetados por uma edição. */
export function refreshStore(...tags: ("catalog" | "settings" | "landing" | "faq" | "testimonials")[]) {
  for (const t of tags) revalidateTag(t);
  revalidatePath("/", "layout");
}
