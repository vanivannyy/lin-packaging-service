import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect: redirectTo } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
            LP
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">LIN PACKAGING</p>
            <p className="text-xs uppercase tracking-widest text-slate-400">Service</p>
          </div>
        </div>

        <form action={loginAction} className="rounded-xl bg-white p-6 shadow-xl">
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Masuk ke akun Anda</h1>
          <p className="mb-5 text-sm text-gray-500">Sistem kontrol bisnis PT Lin Packaging Jakarta</p>

          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue="owner@lin-packaging.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              defaultValue="password123"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            Masuk
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            Demo: owner@lin-packaging.com / password123
          </p>
        </form>
      </div>
    </div>
  );
}
