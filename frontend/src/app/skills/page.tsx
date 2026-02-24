"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RegistrySkill {
  id: string;
  description: string;
  version: string;
  author: string;
}

interface PaidSkillListing {
  id: string;
  title: string;
  description: string;
  price: number;
  sellerAddress: string;
  createdAt: string | null;
}

export default function SkillsCatalog() {
  const [registrySkills, setRegistrySkills] = useState<RegistrySkill[]>([]);
  const [paidListings, setPaidListings] = useState<PaidSkillListing[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/skills/registry")
        .then((r) => r.json())
        .then((d) => setRegistrySkills(d.skills ?? [])),
      fetch("/api/marketplace/listings?type=skill")
        .then((r) => r.json())
        .then((d) => setPaidListings(d.listings ?? [])),
    ]).finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filteredRegistry = registrySkills.filter(
    (s) => s.id.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  );
  const filteredPaid = paidListings.filter(
    (l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
  );

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
              <Link href="/skills" className="font-medium text-primary">
                Skills
              </Link>
              <Link
                href="/souls"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
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
          <h1 className="mb-2 text-2xl font-semibold">Skill Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Browse free registry skills and premium skills from the community.
          </p>
        </div>

        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">
            {filteredPaid.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Premium Skills
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPaid.map((l) => (
                    <Link
                      key={l.id}
                      href={`/marketplace/${l.id}`}
                      className="group rounded-lg border border-border p-4 transition-all hover:border-primary/50 hover:shadow-sm"
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
                Free Registry Skills ({filteredRegistry.length})
              </h2>
              {filteredRegistry.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No skills match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRegistry.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{s.id}</span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Free
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                        {s.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          by {s.author}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          v{s.version}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
