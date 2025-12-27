import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
        <div className="text-sm text-zinc-400">404</div>
        <h1 className="text-2xl font-bold mt-2">Page not found</h1>
        <p className="text-zinc-400 mt-2">
          This route doesn’t exist. If you were looking for KOL Wrapped, go back home.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/KOLwrapped"
            className="px-4 py-2 rounded-lg bg-white text-black font-medium"
          >
            Go to KOL Wrapped
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-white/10 text-zinc-200"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}