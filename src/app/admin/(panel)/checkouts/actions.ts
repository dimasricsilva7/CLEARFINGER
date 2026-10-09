"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resendLeadEmail } from "@/lib/email";
import { withAdmin, type ActionResult } from "@/server/admin/guard";
import { str } from "@/server/admin/forms";

export async function sendLeadEmailAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("EDITOR", async (admin) => {
    const id = str(fd, "id", 40);
    const lead = await db.checkoutLead.findUnique({ where: { id }, select: { email: true } });
    if (!lead?.email) return { error: "Este checkout não tem e-mail (só WhatsApp)." };
    const r = await resendLeadEmail(id);
    await audit(admin.id, "lead_email_sent", "checkoutLead", id, { summary: `E-mail de checkout abandonado para ${lead.email}: ${r.ok ? "enviado" : r.error}` });
    revalidatePath("/admin/checkouts");
    return r.ok ? { ok: true, message: "E-mail enviado." } : { error: r.error };
  });
}

export async function deleteLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withAdmin("ADMIN", async (admin) => {
    const id = str(fd, "id", 40);
    const lead = await db.checkoutLead.delete({ where: { id } });
    await audit(admin.id, "lead_deleted", "checkoutLead", id, { summary: `Checkout de ${lead.email ?? lead.phone ?? "sem contato"} excluído` });
    revalidatePath("/admin/checkouts");
    return { ok: true, message: "Excluído." };
  });
}
