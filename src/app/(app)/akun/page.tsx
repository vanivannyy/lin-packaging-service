import { PasswordField } from "@/app/login/PasswordField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Table";
import { requireSession } from "@/lib/require-session";
import { changePasswordAction } from "./actions";

export default async function AkunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireSession();
  const { error, ok } = await searchParams;

  return (
    <div>
      <PageHeader eyebrow="Akun" title="Ganti password" />

      <Card className="max-w-md p-4">
        <p className="mb-1 text-sm font-medium text-gray-900">{session.name}</p>
        <p className="mb-4 text-sm text-gray-500">{session.email}</p>

        {ok ? (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Password berhasil diganti.
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <form action={changePasswordAction} className="space-y-3">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Password saat ini
            </label>
            <PasswordField id="currentPassword" name="currentPassword" autoComplete="current-password" />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Password baru
            </label>
            <PasswordField id="newPassword" name="newPassword" autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Ulangi password baru
            </label>
            <PasswordField id="confirmPassword" name="confirmPassword" autoComplete="new-password" />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Simpan password
          </button>
        </form>
      </Card>
    </div>
  );
}
