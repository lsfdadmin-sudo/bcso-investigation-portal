import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-obsidian px-6 text-center">
      <p className="font-mono text-xs tracking-[0.2em] text-gold">BCSO</p>
      <h1 className="font-display text-4xl">Page not on file</h1>
      <Link href="/board" className="text-sm text-fog underline-offset-4 hover:underline">
        Return to the case board
      </Link>
    </main>
  );
}
