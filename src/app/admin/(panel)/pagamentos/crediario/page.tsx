import Link from "next/link";
import { ConfirmAction } from "@/components/admin/client";
import { PageHeader, btnSecondary } from "@/components/admin/ui";
import { CREDIARIO_KEYS } from "@/lib/settings-defaults";
import { getMainProduct } from "@/server/catalog";
import { getSettingsFresh } from "@/server/settings";
import { resetSettingsGroup } from "../../sistema-actions";
import { CrediarioEditor } from "./CrediarioEditor";

export const metadata = { title: "Crediário" };

export default async function CrediarioSettingsPage() {
  const [s, product] = await Promise.all([getSettingsFresh(), getMainProduct()]);
  const initial = Object.fromEntries(CREDIARIO_KEYS.map((k) => [k, s[k] ?? ""]));
  const sample = product?.offers[0]?.priceCents ?? 5990;
  return (
    <div>
      <PageHeader
        title="Pagamentos → Crediário"
        description="Método próprio baseado em protocolo (não é cartão). Todos os títulos, placeholders, dígitos, formato da validade, parcelas e mensagens são editáveis aqui."
        actions={
          <>
            <Link href="/admin/pagamentos" className={btnSecondary}>PIX</Link>
            <Link href="/admin/pedidos?metodo=CREDIARIO" className={btnSecondary}>Pedidos no crediário</Link>
            <ConfirmAction action={resetSettingsGroup} label="Restaurar textos padrão" hidden={{ prefix: "crediario_" }} description="Todos os textos e regras do crediário voltam aos valores iniciais." />
          </>
        }
      />
      <CrediarioEditor initial={initial} sampleTotalCents={sample} />
    </div>
  );
}
