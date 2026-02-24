"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { STARTER_SOULS } from "@/lib/souls";

interface PaidSoulListing {
  id: string;
  title: string;
  description: string;
  price: number;
  sellerAddress: string;
  createdAt: string | null;
}

const SOUL_ICONS: Record<string, string> = {
  sparkle:
    "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
  chart:
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  palette:
    "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z",
  shield:
    "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  code: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5",
};

export default function SoulsCatalog() {
  const [paidListings, setPaidListings] = useState<PaidSoulListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace/listings?type=soul")
      .then((r) => r.json())
      .then((d) => setPaidListings(d.listings ?? []))
      .finally(() => setLoading(false));
  }, []);

  const hasSession =
    typeof window !== "undefined" && !!localStorage.getItem("clawt-session");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              CLAWT
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/skills"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Skills
              </Link>
              <Link href="/souls" className="font-medium text-primary">
                Souls
              </Link>
            </nav>
          </div>
          {hasSession && (
            <Link
              href="/sell"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sell
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold">Soul Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Choose a personality for your agent. Free starter souls are available at setup. Buy
            premium souls from the community.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">
            {paidListings.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Premium Souls
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {paidListings.map((l) => (
                    <Link
                      key={l.id}
                      href={`/marketplace/${l.id}`}
                      className="group rounded-lg border border-border p-5 transition-all hover:border-primary/50 hover:shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium group-hover:text-primary">
                          {l.title}
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          ${(l.price / 1_000_000).toFixed(2)}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                        {l.description}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        by {l.sellerAddress.slice(0, 6)}...{l.sellerAddress.slice(-4)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Free Starter Souls
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {STARTER_SOULS.map((soul) => (
                  <div
                    key={soul.id}
                    className="rounded-lg border border-border p-5"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <svg
                        className="h-5 w-5 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={SOUL_ICONS[soul.icon] ?? SOUL_ICONS.sparkle}
                        />
                      </svg>
                      <span className="text-sm font-medium">{soul.name}</span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Free
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {soul.tagline}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Available during agent setup
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
