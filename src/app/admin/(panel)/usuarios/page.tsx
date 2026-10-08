import { Badge, Card, Field, PageHeader, inputCls } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/utils/format";
import { changeOwnPassword, saveAdminUser } from "../sistema-actions";

export const metadata = { title: "Usuários" };
type User = Awaited<ReturnType<typeof db.adminUser.findMany>>[number];

function UserForm({ u }: { u: User | null }) {
  return (
    <ActionForm action={saveAdminUser} resetOnSuccess={!u} className="grid gap-3 md:grid-cols-4">
      {u && <input type="hidden" name="id" value={u.id} />}
      <Field label="Nome"><input name="name" defaultValue={u?.name ?? ""} className={inputCls} /></Field>
      <Field label="E-mail"><input name="email" type="email" required defaultValue={u?.email ?? ""} className={inputCls} /></Field>
      <Field label="Papel">
        <select name="role" defaultValue={u?.role ?? "EDITOR"} className={inputCls}>
          <option value="EDITOR">Editor (conteúdo e pedidos)</option>
          <option value="ADMIN">Admin (tudo, exceto usuários)</option>
          <option value="OWNER">Proprietário</option>
        </select>
      </Field>
      <Field label={u ? "Nova senha (opcional)" : "Senha inicial"} hint="12+ caracteres"><input name="password" type="password" autoComplete="new-password" className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={u?.active ?? true} className="h-4 w-4" /> Ativo</label>
      <div className="md:col-span-4"><SubmitButton>{u ? "Salvar" : "Criar usuário"}</SubmitButton></div>
    </ActionForm>
  );
}

function PasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} resetOnSuccess className="grid max-w-xl gap-3 md:grid-cols-2">
      <Field label="Senha atual"><input name="current" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      <Field label="Nova senha" hint="12+ caracteres"><input name="next" type="password" autoComplete="new-password" required className={inputCls} /></Field>
      <div className="md:col-span-2"><SubmitButton>Alterar senha</SubmitButton></div>
    </ActionForm>
  );
}

export default async function UsersPage() {
  const me = await requireAdmin();
  if (me.role !== "OWNER") {
    return (
      <div className="space-y-6">
        <PageHeader title="Minha conta" />
        <Card title="Alterar senha"><PasswordForm /></Card>
      </div>
    );
  }
  const users = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Usuários do admin" description="Sessões seguras (cookie httpOnly, 12h), senhas com bcrypt e bloqueio após tentativas falhas." />
      {users.map((u) => (
        <Card
          key={u.id}
          title={u.email}
          actions={
            <span className="flex items-center gap-2 text-xs text-slate-500">
              {u.lastLoginAt ? `último acesso ${formatDate(u.lastLoginAt, true)}` : "nunca acessou"} {u.active ? <Badge tone="green">{u.role}</Badge> : <Badge>inativo</Badge>}
            </span>
          }
        >
          <UserForm u={u} />
        </Card>
      ))}
      <Card title="Novo usuário"><UserForm u={null} /></Card>
      <Card title="Alterar minha senha"><PasswordForm /></Card>
    </div>
  );
}
